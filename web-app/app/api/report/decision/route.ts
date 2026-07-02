import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { applyDecision } from '@/lib/decisions'
import { validateBody, errorResponse } from '@/lib/validation'

const staffDecisionSchema = z.object({
  candidateId: z.string().min(1).max(100),
  postingId: z.string().min(1).max(100),
  decision: z.enum(['accepted', 'maybe', 'rejected']).nullable(),
  // The client's name when recording feedback given over a call
  decidedBy: z.string().max(120).optional(),
  candidateEmail: z.string().max(200).optional(),
  stage: z.string().max(120).optional(),
})

/**
 * POST /api/report/decision — staff-only decision override.
 * Recruiters can set, change or clear a client decision on the client's
 * behalf (clients often give feedback on calls instead of in the report),
 * regardless of the candidate's current stage.
 */
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: validationError } = await validateBody(req, staffDecisionSchema)
    if (validationError) return validationError

    const result = await applyDecision({
      candidateId: body.candidateId,
      postingId: body.postingId,
      candidateEmail: body.candidateEmail || null,
      stage: body.stage || null,
      decision: body.decision,
      decidedBy: body.decidedBy?.trim() || `${token.name || token.email} (Academy)`,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return errorResponse(error, 'Staff decision error')
  }
}
