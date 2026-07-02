// Client decision handling shared by the public share route and the internal
// staff route. A decision is 'accepted' | 'maybe' | 'rejected' (null clears).
// Accepting from a presenting stage advances the candidate to Client Interview
// in Lever — but only on the transition into 'accepted', so changing your mind
// afterwards never re-fires the move, and later decisions always win.
import { supabase } from '@/lib/supabase'
import { fetchStages } from '@/lib/lever'
import { isPresentingStage } from '@/lib/stages'
import { recordClientInterviewReached } from '@/lib/milestones'

export type ClientDecision = 'accepted' | 'maybe' | 'rejected'

const lower = (s: string | null | undefined) => (s || '').trim().toLowerCase()

// Decisions can be made in a presenting stage, and *changed* after the accept
// side-effect has moved the candidate to Client Interview.
export function canDecideStage(stage: string | null | undefined): boolean {
  return isPresentingStage(stage) || lower(stage) === 'client interview'
}

async function moveToClientInterview(candidateId: string): Promise<void> {
  const leverKey = process.env.LEVER_API_KEY
  if (!leverKey) return
  try {
    const stages = await fetchStages()
    const target = stages.find((s) => lower(s.text) === 'client interview')
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

export async function getDecision(candidateId: string, postingId: string) {
  const { data } = await supabase
    .from('client_decisions' as any)
    .select('decision, decided_by')
    .eq('candidate_id', candidateId)
    .eq('posting_id', postingId)
    .maybeSingle()
  return {
    decision: ((data as any)?.decision as ClientDecision | undefined) || null,
    decidedBy: ((data as any)?.decided_by as string | undefined) || null,
  }
}

export async function applyDecision(opts: {
  candidateId: string
  postingId: string
  candidateEmail?: string | null
  stage?: string | null // candidate's current Lever stage, when known
  decision: ClientDecision | null
  decidedBy: string
  shareToken?: string | null
}): Promise<{ decision: ClientDecision | null }> {
  const { candidateId, postingId } = opts

  if (opts.decision === null) {
    const { error } = await supabase
      .from('client_decisions' as any)
      .delete()
      .eq('candidate_id', candidateId)
      .eq('posting_id', postingId)
    if (error) throw error
    return { decision: null }
  }

  const previous = await getDecision(candidateId, postingId)

  const { error } = await supabase
    .from('client_decisions' as any)
    .upsert(
      {
        candidate_id: candidateId,
        candidate_email: opts.candidateEmail || null,
        posting_id: postingId,
        decision: opts.decision,
        decided_by: opts.decidedBy,
        share_token: opts.shareToken || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'candidate_id,posting_id' }
    )
  if (error) throw error

  // Stage side-effect only on the transition into 'accepted', and only from a
  // presenting stage (never re-fires, never moves someone already advanced).
  if (opts.decision === 'accepted' && previous.decision !== 'accepted') {
    if (isPresentingStage(opts.stage)) {
      await moveToClientInterview(candidateId)
    }
    await recordClientInterviewReached(candidateId, postingId, opts.candidateEmail || null)
  }

  return { decision: opts.decision }
}
