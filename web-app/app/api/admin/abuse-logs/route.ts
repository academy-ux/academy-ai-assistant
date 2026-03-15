export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET: List recent abuse logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')
    const severity = request.nextUrl.searchParams.get('severity') // optional filter

    let query = supabase
      .from('abuse_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Also fetch currently restricted users
    const { data: restrictedUsers } = await supabase
      .from('user_settings')
      .select('user_email, is_restricted, restricted_at, restricted_reason')
      .eq('is_restricted', true)

    return NextResponse.json({
      logs: data,
      count,
      limit,
      offset,
      restrictedUsers: restrictedUsers || [],
    })
  } catch (error) {
    console.error('[Admin] Error fetching abuse logs:', error)
    return NextResponse.json({ error: 'Failed to fetch abuse logs' }, { status: 500 })
  }
}

// POST: Unrestrict a user (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { userEmail, action } = body as { userEmail: string; action: 'unrestrict' | 'restrict' }

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })
    }

    if (action === 'unrestrict') {
      const { error } = await supabase
        .from('user_settings')
        .update({
          is_restricted: false,
          restricted_at: null,
          restricted_reason: null,
        })
        .eq('user_email', userEmail)

      if (error) throw error

      // Log the admin action
      await supabase.from('abuse_logs').insert({
        user_email: userEmail,
        event_type: 'admin_unrestrict',
        severity: 'info',
        endpoint: '/api/admin/abuse-logs',
        details: { admin: session?.user?.email, action: 'unrestrict' },
      })

      return NextResponse.json({ success: true, message: `User ${userEmail} has been unrestricted` })
    }

    if (action === 'restrict') {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_email: userEmail,
          is_restricted: true,
          restricted_at: new Date().toISOString(),
          restricted_reason: `Manually restricted by admin ${session?.user?.email}`,
        }, { onConflict: 'user_email' })

      if (error) throw error

      return NextResponse.json({ success: true, message: `User ${userEmail} has been restricted` })
    }

    return NextResponse.json({ error: 'Invalid action. Use "unrestrict" or "restrict".' }, { status: 400 })
  } catch (error) {
    console.error('[Admin] Error managing user restriction:', error)
    return NextResponse.json({ error: 'Failed to manage user restriction' }, { status: 500 })
  }
}
