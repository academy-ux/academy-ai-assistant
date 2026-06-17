import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCandidatesForPosting } from '@/lib/lever'
import { resolveShare, requestHasShareAccess } from '@/lib/share'
import { errorResponse } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const share = await resolveShare(token)
    if (!share) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    // Soft email gate: restricted shares require a matching email first.
    if (!requestHasShareAccess(request, token, share)) {
      return NextResponse.json(
        { error: 'This report is restricted', requiresEmail: true, postingTitle: share.postingTitle },
        { status: 401 }
      )
    }

    const postingId = share.postingId
    const candidates = await fetchCandidatesForPosting(postingId)

    // Collect the keys we need to enrich against. The email is the join key for
    // pitch/profile/password but is NEVER returned to the client — we resolve
    // everything server-side and only surface the resolved values.
    const emails = Array.from(
      new Set(candidates.map(c => c.email).filter((e): e is string => !!e))
    )
    const candidateIds = candidates.map(c => c.id)

    // Batch-fetch all enrichment data in parallel.
    const [pitchesRes, legacyPitchRes, profilesRes, passwordsRes, decisionsRes] = await Promise.all([
      emails.length
        ? supabase.from('candidate_pitches').select('candidate_email, pitch').eq('posting_id', postingId).in('candidate_email', emails)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase.from('candidate_profiles').select('candidate_email, pitch').in('candidate_email', emails)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase.from('candidate_profiles').select('candidate_email, salary_expectations, years_of_experience').in('candidate_email', emails)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase.from('candidate_passwords').select('candidate_email, password').in('candidate_email', emails)
        : Promise.resolve({ data: [] as any[] }),
      candidateIds.length
        ? supabase.from('client_decisions' as any).select('candidate_id, decision, decided_by').eq('posting_id', postingId).in('candidate_id', candidateIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const pitchByEmail = new Map<string, string>()
    for (const row of (pitchesRes.data || []) as any[]) {
      if (row.pitch) pitchByEmail.set(row.candidate_email, row.pitch)
    }
    // Legacy fallback: pre-migration pitches lived on candidate_profiles.pitch
    for (const row of (legacyPitchRes.data || []) as any[]) {
      if (row.pitch && !pitchByEmail.has(row.candidate_email)) {
        pitchByEmail.set(row.candidate_email, row.pitch)
      }
    }

    const profileByEmail = new Map<string, { salary: string | null; relevantYears: number | null; totalYears: number | null; summary: string | null }>()
    for (const row of (profilesRes.data || []) as any[]) {
      let relevantYears: number | null = null
      let totalYears: number | null = null
      let summary: string | null = null
      if (row.years_of_experience) {
        try {
          const parsed = JSON.parse(row.years_of_experience)
          if (parsed && typeof parsed === 'object') {
            relevantYears = parsed.relevantYears ?? null
            totalYears = parsed.totalYears ?? null
            summary = parsed.summary ?? null
          }
        } catch {
          // Old non-JSON format — leave experience numbers null.
        }
      }
      profileByEmail.set(row.candidate_email, {
        salary: row.salary_expectations || null,
        relevantYears,
        totalYears,
        summary,
      })
    }

    const passwordByEmail = new Map<string, string>()
    for (const row of (passwordsRes.data || []) as any[]) {
      if (row.password) passwordByEmail.set(row.candidate_email, row.password)
    }

    const decisionById = new Map<string, { decision: string; decidedBy: string | null }>()
    for (const row of (decisionsRes.data || []) as any[]) {
      decisionById.set(row.candidate_id, { decision: row.decision, decidedBy: row.decided_by || null })
    }

    // Build the public payload — email and answers are deliberately omitted.
    const publicCandidates = candidates.map(c => {
      const profile = c.email ? profileByEmail.get(c.email) : undefined
      const decision = decisionById.get(c.id)
      return {
        id: c.id,
        name: c.name,
        headline: c.headline,
        location: c.location,
        links: c.links,
        position: c.position,
        postingId: c.postingId,
        stage: c.stage,
        createdAt: c.createdAt,
        isUncategorized: c.isUncategorized,
        archivedAt: c.archivedAt,
        archivedReason: c.archivedReason,
        // Enriched, client-facing fields:
        pitch: (c.email ? pitchByEmail.get(c.email) : null) || null,
        salary: profile?.salary || null,
        relevantYears: profile?.relevantYears ?? null,
        totalYears: profile?.totalYears ?? null,
        experienceSummary: profile?.summary || null,
        portfolioPassword: (c.email ? passwordByEmail.get(c.email) : null) || null,
        clientDecision: decision?.decision || null,
        clientDecisionBy: decision?.decidedBy || null,
        // Deliberately omitting: email, answers
      }
    })

    return NextResponse.json({
      success: true,
      candidates: publicCandidates,
      postingTitle: share.postingTitle,
    })
  } catch (error) {
    return errorResponse(error, 'Share candidates error')
  }
}
