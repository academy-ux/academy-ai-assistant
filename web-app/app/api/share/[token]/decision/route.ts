import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { resolveShareCandidate, requestHasShareAccess } from '@/lib/share'
import { isPresentingStage } from '@/lib/stages'
import { fetchStages } from '@/lib/lever'
import { validateBody, errorResponse } from '@/lib/validation'

// When a client accepts a candidate, advance them to the Client Interview stage.
async function moveToClientInterview(candidateId: string): Promise<void> {
  const leverKey = process.env.LEVER_API_KEY
  if (!leverKey) return
  try {
    const stages = await fetchStages()
    const target = stages.find(s => s.text.trim().toLowerCase() === 'client interview')
    if (!target) {
      console.error('[Decision] Client Interview stage not found in Lever')
      return
    }
    const res = await fetch(`https://api.lever.co/v1/opportunities/${candidateId}/stage`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stage: target.id }),
    })
    if (!res.ok) {
      console.error('[Decision] Failed to move candidate to Client Interview:', res.status)
    }
  } catch (e) {
    console.error('[Decision] moveToClientInterview error:', e)
  }
}

/**
 * GET /api/share/[token]/decision?candidateId=xxx
 * Returns the current client decision for a candidate (or null).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const candidateId = request.nextUrl.searchParams.get('candidateId')
    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
    }

    const resolved = await resolveShareCandidate(token, candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const { data } = await supabase
      .from('client_decisions' as any)
      .select('decision, decided_by')
      .eq('candidate_id', candidateId)
      .eq('posting_id', resolved.postingId)
      .single()

    return NextResponse.json({
      decision: (data as any)?.decision || null,
      decidedBy: (data as any)?.decided_by || null,
    })
  } catch (error) {
    return errorResponse(error, 'Share decision read error')
  }
}

const decisionSchema = z.object({
  candidateId: z.string().min(1).max(100),
  // null clears the decision (client changed their mind)
  decision: z.enum(['accepted', 'rejected']).nullable(),
  decidedBy: z.string().max(120).optional(),
})

/**
 * POST /api/share/[token]/decision
 * Body: { candidateId, decision: 'accepted' | 'rejected' | null, decidedBy? }
 * Records the client's accept/reject. This is advisory only — it does NOT move
 * the candidate's Lever stage; recruiters act on it manually.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: body, error: validationError } = await validateBody(request, decisionSchema)
    if (validationError) return validationError

    const resolved = await resolveShareCandidate(token, body.candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    // Accept/reject is only available for presenting-stage candidates.
    if (!isPresentingStage(resolved.candidate.stage)) {
      return NextResponse.json({ error: 'This candidate is not available for a decision' }, { status: 400 })
    }

    // Clearing the decision.
    if (body.decision === null) {
      const { error } = await supabase
        .from('client_decisions' as any)
        .delete()
        .eq('candidate_id', body.candidateId)
        .eq('posting_id', resolved.postingId)
      if (error) throw error
      return NextResponse.json({ success: true, decision: null })
    }

    const { error } = await supabase
      .from('client_decisions' as any)
      .upsert({
        candidate_id: body.candidateId,
        candidate_email: resolved.candidate.email || null,
        posting_id: resolved.postingId,
        decision: body.decision,
        decided_by: body.decidedBy?.trim() || 'Client',
        share_token: token,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'candidate_id,posting_id' })

    if (error) throw error

    // Accepting a candidate advances them to the Client Interview stage in Lever.
    if (body.decision === 'accepted') {
      await moveToClientInterview(body.candidateId)
    }

    return NextResponse.json({ success: true, decision: body.decision })
  } catch (error) {
    return errorResponse(error, 'Share decision write error')
  }
}
