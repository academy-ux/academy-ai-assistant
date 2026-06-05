import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
import { exchangeRefreshToken } from '@/lib/auth'
import { pollFolder } from '@/lib/drive-polling'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Pro plan allows up to 60s

// Errors that mean the user's Google grant is no longer usable and they must
// reconnect (re-consent) — an expired/revoked refresh token, or a token that
// lacks the Drive scope. We clear the stored token for these so the cron stops
// retrying it every run; other (possibly transient) errors are left alone.
function isReauthRequired(message: string): boolean {
  const m = (message || '').toLowerCase()
  return (
    m.includes('invalid_grant') ||
    m.includes('expired or revoked') ||
    m.includes('insufficient permission') ||
    m.includes('insufficient_scope') ||
    m.includes('invalid_scope') ||
    m.includes('invalid_client')
  )
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron Poll] ========================================')
  console.log('[Cron Poll] Starting scheduled poll')
  console.log('[Cron Poll] ========================================')

  // Fetch all users who have a configured folder and a stored refresh token.
  // We do NOT require auto_poll_enabled=true — the presence of a refresh token +
  // folder is enough signal that the user wants background polling, and this
  // ensures Drive scans happen for every connected user regardless of whether
  // anyone is currently signed into the app. Users who explicitly opted out
  // (auto_poll_enabled=false) are still respected.
  const { data: users, error } = await supabase
    .from('user_settings')
    .select('user_email, drive_folder_id, encrypted_refresh_token, auto_poll_enabled')
    .not('drive_folder_id', 'is', null)
    .not('encrypted_refresh_token', 'is', null)
    .or('auto_poll_enabled.is.null,auto_poll_enabled.eq.true')

  if (error) {
    console.error('[Cron Poll] Failed to fetch users:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!users || users.length === 0) {
    console.log('[Cron Poll] No users with a configured folder to poll')
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
      const message = err?.message || String(err) || 'Unknown error'
      console.error(`[Cron Poll] ❌ ${user.user_email}:`, message)

      // If the grant is dead, clear the stored token so we stop retrying it
      // every run. The user is prompted to reconnect Google next time they open
      // the app, and re-authenticating re-populates encrypted_refresh_token.
      let reauthRequired = false
      if (isReauthRequired(message)) {
        reauthRequired = true
        const { error: clearErr } = await supabase
          .from('user_settings')
          .update({ encrypted_refresh_token: null })
          .eq('user_email', user.user_email)
        if (clearErr) {
          console.error(`[Cron Poll] Failed to clear dead token for ${user.user_email}:`, clearErr.message)
        } else {
          console.log(`[Cron Poll] 🔑 Cleared dead token for ${user.user_email} — reconnect required`)
        }
      }

      results.push({
        email: user.user_email,
        error: message,
        reauthRequired,
      })
    }
  }

  console.log('[Cron Poll] ========== COMPLETE ==========')

  return NextResponse.json({
    message: `Polled ${users.length} user(s)`,
    results,
  })
}
