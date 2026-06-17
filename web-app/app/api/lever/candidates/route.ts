import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'
import { fetchCandidatesForPosting } from '@/lib/lever'
import { supabase } from '@/lib/supabase'

const candidatesQuerySchema = z.object({
  postingId: z.string().max(100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      candidatesQuerySchema
    )
    if (validationError) return validationError

    const candidates = await fetchCandidatesForPosting(params.postingId)

    // Attach any client accept/reject decisions so recruiters see them in the
    // pipeline. These are advisory — they never move the Lever stage themselves.
    let decisionById = new Map<string, { decision: string; decidedBy: string | null }>()
    if (params.postingId && candidates.length) {
      const { data: decisions } = await supabase
        .from('client_decisions' as any)
        .select('candidate_id, decision, decided_by')
        .eq('posting_id', params.postingId)
        .in('candidate_id', candidates.map(c => c.id))
      for (const row of (decisions || []) as any[]) {
        decisionById.set(row.candidate_id, { decision: row.decision, decidedBy: row.decided_by || null })
      }
    }

    const enriched = candidates.map(c => ({
      ...c,
      clientDecision: decisionById.get(c.id)?.decision || null,
      clientDecisionBy: decisionById.get(c.id)?.decidedBy || null,
    }))

    return NextResponse.json({ success: true, candidates: enriched })

  } catch (error) {
    return errorResponse(error, 'Lever candidates error')
  }
}
