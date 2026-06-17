import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCandidatesForPosting, fetchPosting } from '@/lib/lever'
import { resolveShare, requestHasShareAccess } from '@/lib/share'
import { observeAndCountClientInterview } from '@/lib/milestones'
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
    const [candidates, postingMeta] = await Promise.all([
      fetchCandidatesForPosting(postingId),
      fetchPosting(postingId),
    ])

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
        ? supabase.from('candidate_profiles').select('candidate_email, salary_expectations, years_of_experience, current_title, current_company').in('candidate_email', emails)
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

    const profileByEmail = new Map<string, { salary: string | null; relevantYears: number | null; totalYears: number | null; summary: string | null; currentTitle: string | null; currentCompany: string | null }>()
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
        currentTitle: row.current_title || null,
        currentCompany: row.current_company || null,
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
      // Prefer the candidate's current role parsed from their resume.
      const currentTitle = profile?.currentTitle || null
      const currentCompany = profile?.currentCompany || null
      const resumeHeadline = currentTitle && currentCompany
        ? `${currentTitle} at ${currentCompany}`
        : (currentTitle || currentCompany || null)

      return {
        id: c.id,
        name: c.name,
        headline: resumeHeadline || c.headline,
        currentTitle,
        currentCompany,
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

    // Count everyone who ever reached Client Interview (durable — survives a
    // later archive), recording milestones for anyone currently at/past it.
    const reachedClientInterview = await observeAndCountClientInterview(
      candidates.map(c => ({ id: c.id, stage: c.stage, email: c.email })),
      postingId
    )

    return NextResponse.json({
      success: true,
      candidates: publicCandidates,
      postingTitle: share.postingTitle,
      team: postingMeta?.team || null,
      reachedClientInterview,
    })
  } catch (error) {
    return errorResponse(error, 'Share candidates error')
  }
}
