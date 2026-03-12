import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchStages } from '@/lib/lever'
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

    // Validate the token exists and is active
    const { data: share, error } = await supabase
      .from('shared_reports' as any)
      .select('id')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (!share || error) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    const stages = await fetchStages()
    return NextResponse.json({ success: true, stages })
  } catch (error) {
    return errorResponse(error, 'Share stages error')
  }
}
