import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveShareCandidate, requestHasShareAccess } from '@/lib/share'
import { applyDecision, canDecideStage, getDecision } from '@/lib/decisions'
import { validateBody, errorResponse } from '@/lib/validation'

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

    const current = await getDecision(candidateId, resolved.postingId)
    return NextResponse.json(current)
  } catch (error) {
    return errorResponse(error, 'Share decision read error')
  }
}

const decisionSchema = z.object({
  candidateId: z.string().min(1).max(100),
  // null clears the decision (client changed their mind)
  decision: z.enum(['accepted', 'maybe', 'rejected']).nullable(),
  decidedBy: z.string().max(120).optional(),
})

/**
 * POST /api/share/[token]/decision
 * Body: { candidateId, decision: 'accepted' | 'maybe' | 'rejected' | null, decidedBy? }
 * The latest decision always wins and stays editable after an accept has moved
 * the candidate to Client Interview.
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

    // Presenting-stage candidates get decisions; Client Interview keeps them
    // editable (an accept moves the candidate there — changing your mind must
    // still be possible afterwards).
    if (!canDecideStage(resolved.candidate.stage)) {
      return NextResponse.json({ error: 'This candidate is not available for a decision' }, { status: 400 })
    }

    const result = await applyDecision({
      candidateId: body.candidateId,
      postingId: resolved.postingId,
      candidateEmail: resolved.candidate.email,
      stage: resolved.candidate.stage,
      decision: body.decision,
      decidedBy: body.decidedBy?.trim() || 'Client',
      shareToken: token,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return errorResponse(error, 'Share decision write error')
  }
}
