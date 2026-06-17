import { supabase } from '@/lib/supabase'

export interface CurrentRole {
  title: string | null
  company: string | null
}

function leverHeaders() {
  const leverKey = process.env.LEVER_API_KEY || ''
  return { Authorization: `Basic ${Buffer.from(leverKey + ':').toString('base64')}` }
}

// Pick the candidate's present role from parsed resume positions: prefer a
// position with no end date (ongoing), otherwise the one with the latest start.
function pickCurrentPosition(positions: any[]): CurrentRole {
  if (!Array.isArray(positions) || !positions.length) return { title: null, company: null }
  const ongoing = positions.find(p => p && (p.end == null || p.end?.year == null))
  const startYear = (p: any) => (p?.start?.year || 0) * 12 + (p?.start?.month || 0)
  const chosen = ongoing || [...positions].sort((a, b) => startYear(b) - startYear(a))[0]
  return {
    title: chosen?.title?.trim() || null,
    company: chosen?.org?.trim() || null,
  }
}

/**
 * Resolve each candidate's current title/company from their Lever resume,
 * caching the result on candidate_profiles. Cached candidates are returned
 * immediately; only the uncached ones hit Lever (batched). Returns a map keyed
 * by candidate id.
 */
export async function ensureCurrentRoles(
  candidates: { id: string; email: string | null }[],
  // postingId is accepted for symmetry with the experience pipeline; role data
  // isn't posting-specific, so it isn't used for the cache key.
  _postingId: string | null
): Promise<Record<string, CurrentRole>> {
  const result: Record<string, CurrentRole> = {}
  if (!process.env.LEVER_API_KEY) return result

  const emails = Array.from(new Set(candidates.map(c => c.email).filter((e): e is string => !!e)))
  const cached = new Map<string, CurrentRole>()
  if (emails.length) {
    const { data } = await supabase
      .from('candidate_profiles')
      .select('candidate_email, current_title, current_company')
      .in('candidate_email', emails)
    for (const row of (data || []) as any[]) {
      if (row.current_title || row.current_company) {
        cached.set(row.candidate_email, { title: row.current_title || null, company: row.current_company || null })
      }
    }
  }

  const needsFetch: { id: string; email: string | null }[] = []
  for (const c of candidates) {
    if (c.email && cached.has(c.email)) {
      result[c.id] = cached.get(c.email)!
    } else {
      needsFetch.push(c)
    }
  }

  const headers = leverHeaders()
  const BATCH = 5
  for (let i = 0; i < needsFetch.length; i += BATCH) {
    const batch = needsFetch.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (c) => {
        try {
          const res = await fetch(`https://api.lever.co/v1/opportunities/${c.id}/resumes`, { headers })
          if (!res.ok) { result[c.id] = { title: null, company: null }; return }
          const data = await res.json()
          const positions = data.data?.[0]?.parsedData?.positions
          const role = pickCurrentPosition(positions || [])
          result[c.id] = role
          if (c.email && (role.title || role.company)) {
            await supabase
              .from('candidate_profiles')
              .upsert({
                candidate_email: c.email,
                current_title: role.title,
                current_company: role.company,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'candidate_email' })
          }
        } catch {
          result[c.id] = { title: null, company: null }
        }
      })
    )
  }

  return result
}
