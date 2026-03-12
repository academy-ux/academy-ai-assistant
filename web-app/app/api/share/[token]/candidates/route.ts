import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchCandidatesForPosting } from '@/lib/lever'
import { errorResponse } from '@/lib/validation'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!UUID_REGEX.test(token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const { data: share, error } = await supabase
      .from('shared_reports' as any)
      .select('posting_id, posting_title')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (!share || error) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    const candidates = await fetchCandidatesForPosting((share as any).posting_id)

    // Strip sensitive fields for public consumption
    const publicCandidates = candidates.map(c => ({
      id: c.id,
      name: c.name,
      headline: c.headline,
      location: c.location,
      links: c.links,
      position: c.position,
      postingId: c.postingId,
      stage: c.stage,
      createdAt: c.createdAt,
      isUncategorized: c.isUncategorized,
      archivedAt: c.archivedAt,
      archivedReason: c.archivedReason,
      // Deliberately omitting: email, answers
    }))

    return NextResponse.json({
      success: true,
      candidates: publicCandidates,
      postingTitle: (share as any).posting_title,
    })
  } catch (error) {
    return errorResponse(error, 'Share candidates error')
  }
}
