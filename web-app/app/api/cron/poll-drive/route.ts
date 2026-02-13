import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
import { exchangeRefreshToken } from '@/lib/auth'
import { pollFolder } from '@/lib/drive-polling'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Pro plan allows up to 60s

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron Poll] ========================================')
  console.log('[Cron Poll] Starting scheduled poll')
  console.log('[Cron Poll] ========================================')

  // Fetch all users who have auto-poll enabled with a configured folder and stored token
  const { data: users, error } = await supabase
    .from('user_settings')
    .select('user_email, drive_folder_id, encrypted_refresh_token')
    .eq('auto_poll_enabled', true)
    .not('drive_folder_id', 'is', null)
    .not('encrypted_refresh_token', 'is', null)

  if (error) {
    console.error('[Cron Poll] Failed to fetch users:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!users || users.length === 0) {
    console.log('[Cron Poll] No users with auto-poll enabled')
    return NextResponse.json({ message: 'No users to poll', results: [] })
  }

  console.log(`[Cron Poll] Found ${users.length} user(s) to poll`)

  const results = []

  for (const user of users) {
    try {
      console.log(`[Cron Poll] Processing: ${user.user_email}`)

      // Decrypt the stored refresh token (non-null guaranteed by query filter)
      const refreshToken = decryptToken(user.encrypted_refresh_token!)

      // Exchange for a fresh access token
      const { accessToken } = await exchangeRefreshToken(refreshToken)

      // Run the poll with fast mode
      const result = await pollFolder(
        accessToken,
        user.drive_folder_id!,
        user.user_email,
        true,  // fastMode
        true   // includeSubfolders
      )

      console.log(`[Cron Poll] ✅ ${user.user_email}: imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors}`)

      results.push({
        email: user.user_email,
        ...result,
      })
    } catch (err: any) {
      console.error(`[Cron Poll] ❌ ${user.user_email}:`, err.message || err)
      results.push({
        email: user.user_email,
        error: err.message || 'Unknown error',
      })
    }
  }

  console.log('[Cron Poll] ========== COMPLETE ==========')

  return NextResponse.json({
    message: `Polled ${users.length} user(s)`,
    results,
  })
}
