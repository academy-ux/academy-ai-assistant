/**
 * Whether a candidate is in the "Presenting" group. Mirrors the grouping logic
 * used by the report pages: presenting covers present/client/offer stages, but
 * NOT the dedicated "client interview" / "portfolio interview" stages.
 *
 * Client accept/reject is only offered for presenting-stage candidates.
 */
export function isPresentingStage(stage: string | null | undefined): boolean {
  const s = (stage || '').toLowerCase()
  if (s === 'client interview' || s === 'portfolio interview') return false
  return s.includes('present') || s.includes('client') || s.includes('offer')
}
