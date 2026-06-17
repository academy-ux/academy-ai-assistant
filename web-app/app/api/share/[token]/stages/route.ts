import { NextRequest, NextResponse } from 'next/server'
import { fetchStages } from '@/lib/lever'
import { resolveShare, requestHasShareAccess } from '@/lib/share'
import { errorResponse } from '@/lib/validation'

export async function GET(
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

    const stages = await fetchStages()
    return NextResponse.json({ success: true, stages })
  } catch (error) {
    return errorResponse(error, 'Share stages error')
  }
}
