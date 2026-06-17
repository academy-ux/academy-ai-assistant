import { supabase } from '@/lib/supabase'

/**
 * Whether a stage is at or beyond "Client Interview". Reaching any of these
 * means the candidate made it into a client interview — even if they're later
 * archived in place (Lever keeps the stage on archived opportunities).
 */
export function reachedClientInterviewStage(stage: string | null | undefined): boolean {
  const s = (stage || '').toLowerCase()
  return s === 'client interview'
    || s.includes('offer')
    || s.includes('hire')
    || s.includes('placed')
}

/** Durably record that a single candidate reached Client Interview. */
export async function recordClientInterviewReached(
  candidateId: string,
  postingId: string,
  email?: string | null
): Promise<void> {
  try {
    await supabase
      .from('client_interview_reached' as any)
      .upsert(
        { candidate_id: candidateId, posting_id: postingId, candidate_email: email || null },
        { onConflict: 'candidate_id,posting_id', ignoreDuplicates: true }
      )
  } catch (e) {
    console.error('[milestones] record error:', e)
  }
}

/**
 * Observe the current pipeline: record a milestone for any candidate at/past
 * Client Interview, then return how many of the pipeline's candidates have EVER
 * reached Client Interview (from the durable table). Counting is restricted to
 * the candidates still in the posting so removed candidates don't inflate it.
 */
export async function observeAndCountClientInterview(
  candidates: { id: string; stage: string; email?: string | null }[],
  postingId: string
): Promise<number> {
  const reachedNow = candidates.filter(c => reachedClientInterviewStage(c.stage))
  if (reachedNow.length) {
    try {
      await supabase
        .from('client_interview_reached' as any)
        .upsert(
          reachedNow.map(c => ({ candidate_id: c.id, posting_id: postingId, candidate_email: c.email || null })),
          { onConflict: 'candidate_id,posting_id', ignoreDuplicates: true }
        )
    } catch (e) {
      console.error('[milestones] observe upsert error:', e)
    }
  }

  const ids = candidates.map(c => c.id)
  if (!ids.length) return 0
  try {
    const { count } = await supabase
      .from('client_interview_reached' as any)
      .select('candidate_id', { count: 'exact', head: true })
      .eq('posting_id', postingId)
      .in('candidate_id', ids)
    return count || reachedNow.length
  } catch (e) {
    console.error('[milestones] count error:', e)
    return reachedNow.length
  }
}
