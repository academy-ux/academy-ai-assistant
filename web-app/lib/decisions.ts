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

// Move a candidate to the Lever stage whose text matches `stageText`.
async function moveToStage(candidateId: string, stageText: string): Promise<boolean> {
  const leverKey = process.env.LEVER_API_KEY
  if (!leverKey || !stageText) return false
  try {
    const stages = await fetchStages()
    const target = stages.find((s) => lower(s.text) === lower(stageText))
    if (!target) {
      console.error(`[Decision] Stage "${stageText}" not found in Lever`)
      return false
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
      console.error(`[Decision] Failed to move candidate to "${stageText}":`, res.status)
      return false
    }
    return true
  } catch (e) {
    console.error('[Decision] moveToStage error:', e)
    return false
  }
}

export async function getDecision(candidateId: string, postingId: string) {
  const { data } = await supabase
    .from('client_decisions' as any)
    .select('decision, decided_by, moved_from_stage')
    .eq('candidate_id', candidateId)
    .eq('posting_id', postingId)
    .maybeSingle()
  return {
    decision: ((data as any)?.decision as ClientDecision | undefined) || null,
    decidedBy: ((data as any)?.decided_by as string | undefined) || null,
    movedFromStage: ((data as any)?.moved_from_stage as string | undefined) || null,
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
  const previous = await getDecision(candidateId, postingId)

  // Only "accepted" advances the candidate to Client Interview. "maybe" and
  // "rejected" leave them where they are. Changing away from "accepted" (or
  // clearing) moves them back to the stage they were in before the accept.
  let movedFromStage = previous.movedFromStage

  if (opts.decision === 'accepted' && previous.decision !== 'accepted') {
    // Capture the origin stage and move — unless they're already at Client
    // Interview (nothing to advance, nothing to restore later).
    if (isPresentingStage(opts.stage) && lower(opts.stage) !== 'client interview') {
      const moved = await moveToStage(candidateId, 'Client Interview')
      if (moved) movedFromStage = opts.stage || null
    }
    await recordClientInterviewReached(candidateId, postingId, opts.candidateEmail || null)
  } else if (opts.decision !== 'accepted' && previous.decision === 'accepted') {
    // Reverting an accept: put them back where they came from. If we never
    // recorded an origin (accepted before this was tracked) but they're sitting
    // at Client Interview, fall back to the stage clients review from.
    const back = previous.movedFromStage
      || (lower(opts.stage) === 'client interview' ? 'Present Candidate to Client' : null)
    if (back) await moveToStage(candidateId, back)
    movedFromStage = null
  }

  if (opts.decision === null) {
    const { error } = await supabase
      .from('client_decisions' as any)
      .delete()
      .eq('candidate_id', candidateId)
      .eq('posting_id', postingId)
    if (error) throw error
    return { decision: null }
  }

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
        moved_from_stage: movedFromStage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'candidate_id,posting_id' }
    )
  if (error) throw error

  return { decision: opts.decision }
}
