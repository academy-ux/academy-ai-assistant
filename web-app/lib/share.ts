import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCandidatesForPosting, type LeverCandidate } from '@/lib/lever'
import { signValue, verifySignedValue } from '@/lib/crypto'

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ResolvedShare {
  postingId: string
  postingTitle: string | null
  allowedEmails: string[]
  allowedDomains: string[]
}

/**
 * Validate a public share token and return its posting context + access rules.
 * Returns null if the token is malformed, unknown, or deactivated.
 */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  if (!UUID_REGEX.test(token)) return null

  const { data: share, error } = await supabase
    .from('shared_reports' as any)
    .select('posting_id, posting_title, allowed_emails, allowed_domains')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!share || error) return null

  return {
    postingId: (share as any).posting_id,
    postingTitle: (share as any).posting_title ?? null,
    allowedEmails: ((share as any).allowed_emails as string[]) ?? [],
    allowedDomains: ((share as any).allowed_domains as string[]) ?? [],
  }
}

/**
 * Resolve a candidate within a share by its (public) Lever id. The client only
 * ever knows the candidate id, so we map id -> full candidate (incl. email) here
 * on the server. Returns null if the candidate isn't part of this share's posting.
 */
export async function resolveShareCandidate(
  token: string,
  candidateId: string
): Promise<{ postingId: string; candidate: LeverCandidate; share: ResolvedShare } | null> {
  const share = await resolveShare(token)
  if (!share) return null

  const candidates = await fetchCandidatesForPosting(share.postingId)
  const candidate = candidates.find(c => c.id === candidateId)
  if (!candidate) return null

  return { postingId: share.postingId, candidate, share }
}

// ─── Soft email-gate access control ──────────────────────────────────────────

/** Whether a share is locked to specific emails/domains (vs. fully public). */
export function isShareRestricted(share: Pick<ResolvedShare, 'allowedEmails' | 'allowedDomains'>): boolean {
  return (share.allowedEmails?.length || 0) > 0 || (share.allowedDomains?.length || 0) > 0
}

/** Does this email satisfy the share's allowlist? */
export function emailMatchesShare(
  email: string,
  share: Pick<ResolvedShare, 'allowedEmails' | 'allowedDomains'>
): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return false
  if (share.allowedEmails?.some(e => e.trim().toLowerCase() === normalized)) return true
  const domain = normalized.split('@')[1]
  if (!domain) return false
  return !!share.allowedDomains?.some(d => d.trim().toLowerCase().replace(/^@/, '') === domain)
}

/**
 * Parse a free-text allowlist (comma/space/newline separated). Entries with a
 * local part ("a@b.com") are treated as exact emails; bare domains ("b.com" or
 * "@b.com") are treated as domain rules.
 */
export function parseAllowlist(input: string): { emails: string[]; domains: string[] } {
  const emails = new Set<string>()
  const domains = new Set<string>()
  for (const raw of input.split(/[\s,;]+/)) {
    const token = raw.trim().toLowerCase()
    if (!token) continue
    if (token.startsWith('@')) {
      const d = token.slice(1)
      if (d.includes('.')) domains.add(d)
    } else if (token.includes('@')) {
      // local@domain — exact email
      if (token.split('@')[1]?.includes('.')) emails.add(token)
    } else if (token.includes('.')) {
      // bare domain
      domains.add(token)
    }
  }
  return { emails: Array.from(emails), domains: Array.from(domains) }
}

export function shareAccessCookieName(token: string): string {
  return `share_access_${token}`
}

/** Mint a signed cookie value granting this email access to this token. */
export function mintShareAccessCookie(token: string, email: string): string {
  return signValue(`${token}:${email.trim().toLowerCase()}`)
}

/**
 * Whether the incoming request is allowed to read this share's data. Public
 * shares always pass; restricted shares require a valid signed cookie whose
 * email still satisfies the (possibly updated) allowlist.
 */
export function requestHasShareAccess(
  request: NextRequest,
  token: string,
  share: Pick<ResolvedShare, 'allowedEmails' | 'allowedDomains'>
): boolean {
  if (!isShareRestricted(share)) return true

  const cookie = request.cookies.get(shareAccessCookieName(token))?.value
  if (!cookie) return false

  const payload = verifySignedValue(cookie)
  if (!payload) return false

  const [cookieToken, email] = payload.split(':')
  if (cookieToken !== token || !email) return false

  // Re-check against the current allowlist in case it changed since issuance.
  return emailMatchesShare(email, share)
}
