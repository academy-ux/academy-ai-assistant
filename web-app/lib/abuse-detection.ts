import { supabase } from '@/lib/supabase'
import { sendAbuseAlert } from '@/lib/alerts'
import type { Json } from '@/types/supabase-generated'

// ============================================
// Types
// ============================================

export type AbuseEventType = 'scrape_attempt' | 'rate_exceeded' | 'bulk_extraction' | 'pattern_flagged'
export type AbuseSeverity = 'warning' | 'critical' | 'blocked'

interface DetectionResult {
  flagged: boolean
  reason: string
  severity: AbuseSeverity
  eventType: AbuseEventType
}

interface BehaviorEntry {
  timestamp: number
  endpoint: string
  query?: string
}

// ============================================
// In-Memory Behavioral Tracking
// ============================================

// Per-user sliding window of recent activity
const userBehavior = new Map<string, BehaviorEntry[]>()

// Periodic cleanup
function cleanupBehavior() {
  const cutoff = Date.now() - 60 * 60 * 1000 // 1 hour
  for (const [email, entries] of userBehavior.entries()) {
    const filtered = entries.filter(e => e.timestamp > cutoff)
    if (filtered.length === 0) {
      userBehavior.delete(email)
    } else {
      userBehavior.set(email, filtered)
    }
  }
}

// Run cleanup randomly (~1% of calls)
function maybeCleanup() {
  if (Math.random() < 0.01) cleanupBehavior()
}

function recordActivity(email: string, endpoint: string, query?: string) {
  maybeCleanup()
  const entries = userBehavior.get(email) || []
  entries.push({ timestamp: Date.now(), endpoint, query })
  userBehavior.set(email, entries)
}

// ============================================
// A) Prompt Classifier — Detect Bulk Extraction Intent
// ============================================

// Patterns that indicate scraping/bulk extraction attempts
const BULK_EXTRACTION_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: AbuseSeverity }> = [
  // Direct "list all" / "give me all" requests
  {
    pattern: /\b(list|show|give|get|tell|provide|send|share)\s+(me\s+)?(all|every|each|the complete|the full|the entire|a complete)\b/i,
    reason: 'Attempted to request complete data listing',
    severity: 'critical',
  },
  // Export / dump requests
  {
    pattern: /\b(export|dump|download|extract|scrape|pull|compile|collect)\s+(all|every|the|a list|candidate|talent|interview|people|names|data)/i,
    reason: 'Attempted to export/dump data',
    severity: 'critical',
  },
  // Spreadsheet / CSV / report of all
  {
    pattern: /\b(spreadsheet|csv|excel|table|report)\s+(of|with|containing|listing)\s+(all|every|each|candidate|talent|people)/i,
    reason: 'Attempted to generate bulk data export format',
    severity: 'critical',
  },
  // Asking for contact info in bulk
  {
    pattern: /\b(emails?|phone|contact|address)(es)?\s+(of|for)\s+(all|every|each|the|our)\s+(candidate|talent|people|interview)/i,
    reason: 'Attempted to extract bulk contact information',
    severity: 'critical',
  },
  // "How many candidates" - enumeration probe
  {
    pattern: /\bhow many\s+(candidate|talent|people|interview|person)s?\s+(do|are|have)\b/i,
    reason: 'Enumeration probe — counting total records',
    severity: 'warning',
  },
  // "Names of all" or "who are all"
  {
    pattern: /\b(names?\s+(of|for)\s+(all|every|each)|who\s+are\s+(all|every)\s+(the|our)?)/i,
    reason: 'Attempted to enumerate all names',
    severity: 'critical',
  },
  // "Everyone who" / "all people who" - broad sweep queries
  {
    pattern: /\b(everyone|everybody|all\s+(people|candidates?|talents?|persons?))\s+who\b/i,
    reason: 'Broad sweep query across all records',
    severity: 'warning',
  },
  // Requests for data about a large number
  {
    pattern: /\b(top|first|next)\s+(\d{2,}|hundred|thousand)\s+(candidate|talent|people|interview)/i,
    reason: 'Requested an unusually large number of records',
    severity: 'critical',
  },
]

export function detectBulkExtraction(query: string): DetectionResult {
  for (const { pattern, reason, severity } of BULK_EXTRACTION_PATTERNS) {
    if (pattern.test(query)) {
      return { flagged: true, reason, severity, eventType: 'bulk_extraction' }
    }
  }
  return { flagged: false, reason: '', severity: 'warning', eventType: 'bulk_extraction' }
}

// ============================================
// B) Behavioral Pattern Tracker
// ============================================

interface BehavioralResult {
  flagged: boolean
  reason: string
  severity: AbuseSeverity
}

export function detectSuspiciousBehavior(
  email: string,
  endpoint: string,
  query?: string
): BehavioralResult {
  // Record this activity
  recordActivity(email, endpoint, query)

  const entries = userBehavior.get(email) || []
  const now = Date.now()

  // Window: last 10 minutes
  const tenMinAgo = now - 10 * 60 * 1000
  const recentEntries = entries.filter(e => e.timestamp > tenMinAgo)

  // Window: last 1 hour
  const oneHourAgo = now - 60 * 60 * 1000
  const hourEntries = entries.filter(e => e.timestamp > oneHourAgo)

  // Check 1: >50 search queries in 10 minutes
  const recentSearches = recentEntries.filter(e =>
    e.endpoint === '/api/interviews/search'
  )
  if (recentSearches.length > 50) {
    return {
      flagged: true,
      reason: `Excessive search volume: ${recentSearches.length} searches in 10 minutes`,
      severity: 'critical',
    }
  }

  // Check 2: >20 unique queries in 10 minutes (rapidly searching different terms)
  const uniqueQueries = new Set(
    recentEntries
      .filter(e => e.query)
      .map(e => e.query!.toLowerCase().trim())
  )
  if (uniqueQueries.size > 20) {
    return {
      flagged: true,
      reason: `Rapid unique query volume: ${uniqueQueries.size} distinct queries in 10 minutes`,
      severity: 'critical',
    }
  }

  // Check 3: >5 AI queries with name-like content in 1 hour
  const aiQueriesWithNames = hourEntries.filter(e =>
    e.endpoint === '/api/interviews/ask' && e.query &&
    // Heuristic: queries containing proper nouns (capitalized words that aren't common words)
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(e.query)
  )
  if (aiQueriesWithNames.length > 5) {
    return {
      flagged: true,
      reason: `Excessive name-based AI queries: ${aiQueriesWithNames.length} in 1 hour`,
      severity: 'warning',
    }
  }

  // Check 4: >30 candidate profile views in 10 minutes
  const profileViews = recentEntries.filter(e =>
    e.endpoint.startsWith('/api/candidates/')
  )
  if (profileViews.length > 30) {
    return {
      flagged: true,
      reason: `Excessive candidate profile access: ${profileViews.length} views in 10 minutes`,
      severity: 'critical',
    }
  }

  // Check 5: Systematic pagination — repeated list requests with incrementing offsets
  const listRequests = recentEntries.filter(e =>
    e.endpoint === '/api/interviews'
  )
  if (listRequests.length > 20) {
    return {
      flagged: true,
      reason: `Excessive list pagination: ${listRequests.length} page loads in 10 minutes`,
      severity: 'warning',
    }
  }

  return { flagged: false, reason: '', severity: 'warning' }
}

// ============================================
// C) User Restriction Check
// ============================================

// In-memory cache to avoid DB hit on every request
const restrictionCache = new Map<string, { restricted: boolean; checkedAt: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds

export async function isUserRestricted(email: string): Promise<boolean> {
  const cached = restrictionCache.get(email)
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
    return cached.restricted
  }

  try {
    const { data } = await supabase
      .from('user_settings')
      .select('is_restricted')
      .eq('user_email', email)
      .single()

    const restricted = data?.is_restricted === true
    restrictionCache.set(email, { restricted, checkedAt: Date.now() })
    return restricted
  } catch {
    // If we can't check, don't block (fail open for DB errors)
    return false
  }
}

// ============================================
// D) Restrict User
// ============================================

export async function restrictUser(email: string, reason: string): Promise<void> {
  try {
    await supabase
      .from('user_settings')
      .upsert(
        {
          user_email: email,
          is_restricted: true,
          restricted_at: new Date().toISOString(),
          restricted_reason: reason,
        },
        { onConflict: 'user_email' }
      )

    // Update cache immediately
    restrictionCache.set(email, { restricted: true, checkedAt: Date.now() })
  } catch (error) {
    console.error('[Abuse] Failed to restrict user:', email, error)
  }
}

// ============================================
// E) Log Abuse Event
// ============================================

export async function logAbuseEvent(params: {
  userEmail: string
  userName?: string
  eventType: AbuseEventType
  severity: AbuseSeverity
  endpoint: string
  details: Record<string, unknown>
}): Promise<void> {
  const { userEmail, userName, eventType, severity, endpoint, details } = params

  // Log to database
  try {
    await supabase.from('abuse_logs').insert({
      user_email: userEmail,
      user_name: userName,
      event_type: eventType,
      severity,
      endpoint,
      details: details as unknown as Json,
    })
  } catch (error) {
    console.error('[Abuse] Failed to log abuse event:', error)
  }

  // Send alerts asynchronously (don't await — fire and forget)
  sendAbuseAlert({
    userEmail,
    userName,
    eventType,
    severity,
    endpoint,
    details,
  }).catch(err => console.error('[Abuse] Alert failed:', err))
}

// ============================================
// F) Combined Check — Use This in API Routes
// ============================================

export async function checkForAbuse(params: {
  userEmail: string
  userName?: string
  endpoint: string
  query?: string
  isAdmin?: boolean
}): Promise<{ blocked: boolean; reason?: string }> {
  const { userEmail, userName, endpoint, query, isAdmin } = params

  // 1. Check if user is already restricted
  const restricted = await isUserRestricted(userEmail)
  if (restricted) {
    return { blocked: true, reason: 'Your account has been restricted due to suspicious activity. Please contact an administrator.' }
  }

  // 2. Check prompt for bulk extraction intent (only for AI/search endpoints)
  if (query) {
    const extraction = detectBulkExtraction(query)
    if (extraction.flagged) {
      // Log and restrict immediately
      await logAbuseEvent({
        userEmail,
        userName,
        eventType: extraction.eventType,
        severity: extraction.severity,
        endpoint,
        details: { query, reason: extraction.reason },
      })

      // Auto-restrict non-admins
      if (!isAdmin) {
        await restrictUser(userEmail, extraction.reason)
        return { blocked: true, reason: 'This request has been flagged as a potential data extraction attempt. Your account has been restricted. Please contact an administrator.' }
      }

      // Admins: log but don't block
      return { blocked: false }
    }
  }

  // 3. Check behavioral patterns (non-admins only)
  if (!isAdmin) {
    const behavior = detectSuspiciousBehavior(userEmail, endpoint, query)
    if (behavior.flagged) {
      await logAbuseEvent({
        userEmail,
        userName,
        eventType: 'pattern_flagged',
        severity: behavior.severity,
        endpoint,
        details: { query, reason: behavior.reason },
      })

      // Auto-restrict on critical severity
      if (behavior.severity === 'critical') {
        await restrictUser(userEmail, behavior.reason)
        return { blocked: true, reason: 'Unusual activity detected on your account. Your access has been temporarily restricted. Please contact an administrator.' }
      }
    }
  }

  return { blocked: false }
}
