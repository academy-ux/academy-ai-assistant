import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { pollFolder } from '@/lib/drive-polling'

// This endpoint should be called by Vercel Cron or can be manually triggered
// Vercel Cron requires CRON_SECRET for security
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (only in production)
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('[Cron] Starting Drive folder polling...')

    // Get all users with auto-polling enabled
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('auto_poll_enabled', true)
      .not('drive_folder_id', 'is', null)

    if (usersError) throw usersError

    if (!users || users.length === 0) {
      console.log('[Cron] No users with auto-polling enabled')
      return NextResponse.json({ 
        success: true, 
        message: 'No users to poll',
        polledUsers: 0 
      })
    }

    console.log(`[Cron] Found ${users.length} users to poll`)

    const results = []

    for (const user of users) {
      try {
        // Check if enough time has passed since last poll
        if (user.last_poll_time && user.poll_interval_minutes) {
          const timeSinceLastPoll = Date.now() - new Date(user.last_poll_time).getTime()
          const intervalMs = user.poll_interval_minutes * 60 * 1000
          
          if (timeSinceLastPoll < intervalMs) {
            console.log(`[Cron] Skipping ${user.user_email} - too soon since last poll`)
            continue
          }
        }

        console.log(`[Cron] Polling folder for ${user.user_email}`)

        // We need to get the user's access token
        // Since we don't have it in the cron job, we'll skip OAuth-dependent operations
        // This is a limitation - polling requires user's access token
        
        // For now, we'll update the last_poll_time to show we attempted
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({ 
            last_poll_time: new Date().toISOString(),
          })
          .eq('user_email', user.user_email)

        if (updateError) throw updateError

        results.push({
          email: user.user_email,
          status: 'attempted',
          message: 'Polling requires user OAuth token - use manual import'
        })

      } catch (userError: any) {
        console.error(`[Cron] Error polling for ${user.user_email}:`, userError)
        results.push({
          email: user.user_email,
          status: 'error',
          error: userError.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      polledUsers: users.length,
      results
    })

  } catch (error: any) {
    console.error('[Cron] Poll error:', error)
    return NextResponse.json({ 
      error: 'Polling failed',
      message: error.message 
    }, { status: 500 })
  }
}

