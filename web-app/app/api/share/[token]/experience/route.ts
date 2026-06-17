import { NextRequest, NextResponse } from 'next/server'
import { fetchCandidatesForPosting } from '@/lib/lever'
import { resolveShare, requestHasShareAccess } from '@/lib/share'
import { computeExperience } from '@/lib/experience'
import { ensureCurrentRoles } from '@/lib/resume-role'
import { errorResponse } from '@/lib/validation'

// Stages worth analyzing — the advanced pipeline a client actually reviews.
// (Mirrors the internal report's experience filter.)
function isAdvancedStage(stage: string): boolean {
  const s = (stage || '').toLowerCase()
  return s === 'client interview'
    || s === 'portfolio interview'
    || s.includes('phone screen')
    || s.includes('present')
    || s.includes('client')
    || s.includes('offer')
}

/**
 * POST /api/share/[token]/experience
 * Computes & caches years-of-experience for the share's advanced-stage
 * candidates so the shared report shows it on first load, even if no internal
 * user has opened the report yet. Results persist in candidate_profiles.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const share = await resolveShare(token)
    if (!share) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }
    if (!requestHasShareAccess(request, token, share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const candidates = await fetchCandidatesForPosting(share.postingId)
    const qualifying = candidates
      .filter(c => !c.archivedAt && isAdvancedStage(c.stage))
      .map(c => ({ id: c.id, email: c.email || null }))

    if (!qualifying.length) {
      return NextResponse.json({ success: true, analyzed: 0 })
    }

    const [experience] = await Promise.all([
      computeExperience(qualifying, share.postingId),
      ensureCurrentRoles(qualifying, share.postingId),
    ])
    return NextResponse.json({ success: true, analyzed: Object.keys(experience).length })
  } catch (error) {
    return errorResponse(error, 'Share experience error')
  }
}
