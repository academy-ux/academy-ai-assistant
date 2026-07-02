// Send email through the signed-in user's own Gmail account, using the same
// stored (encrypted) Google refresh token that powers Drive polling. Requires
// the gmail.send scope — users who signed in before that scope was added need
// to sign out/in once to grant it.
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
import { exchangeRefreshToken } from '@/lib/auth'

export interface SendResult {
  sent: string[]
  failed: { email: string; reason: string }[]
  // Set when nothing could be sent at all (no token / missing scope)
  blocked?: 'no_refresh_token' | 'gmail_scope_missing'
}

const b64url = (s: string) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function buildMime(from: string, fromName: string, to: string, subject: string, html: string): string {
  return [
    `From: ${fromName ? `${fromName} <${from}>` : from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n')
}

export async function sendGmailInvites(opts: {
  senderEmail: string
  senderName?: string | null
  recipients: string[]
  subject: string
  html: string
}): Promise<SendResult> {
  const result: SendResult = { sent: [], failed: [] }

  const { data: settings } = await supabase
    .from('user_settings' as any)
    .select('encrypted_refresh_token')
    .eq('user_email', opts.senderEmail)
    .maybeSingle()

  const encrypted = (settings as any)?.encrypted_refresh_token
  if (!encrypted) {
    result.blocked = 'no_refresh_token'
    return result
  }

  let accessToken: string
  try {
    const refreshToken = decryptToken(encrypted)
    accessToken = (await exchangeRefreshToken(refreshToken)).accessToken
  } catch (e) {
    console.error('[email] token exchange failed', e)
    result.blocked = 'no_refresh_token'
    return result
  }

  for (const to of opts.recipients) {
    try {
      const raw = b64url(buildMime(opts.senderEmail, opts.senderName || '', to, opts.subject, opts.html))
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        result.sent.push(to)
        continue
      }
      const body = await res.text().catch(() => '')
      // 403 with insufficient scopes → the stored grant predates gmail.send
      if (res.status === 403 && /insufficient|scope|permission/i.test(body)) {
        result.blocked = 'gmail_scope_missing'
        result.failed.push({ email: to, reason: 'Gmail permission not granted yet' })
        break
      }
      result.failed.push({ email: to, reason: `Gmail error ${res.status}` })
      console.error('[email] gmail send failed', res.status, body.slice(0, 300))
    } catch (e) {
      result.failed.push({ email: to, reason: 'Network error' })
      console.error('[email] gmail send error', e)
    }
  }
  return result
}

export function shareInviteHtml(opts: {
  senderName: string
  team: string | null
  postingTitle: string | null
  url: string
}): { subject: string; html: string } {
  const title = opts.postingTitle || 'Candidate report'
  const teamLabel = opts.team ? `${opts.team} — ` : ''
  const subject = `${teamLabel}${title} · candidate report from Academy UX`
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#272727">
    <p style="font-size:14px;line-height:1.6">Hi,</p>
    <p style="font-size:14px;line-height:1.6">
      ${opts.senderName} shared a live candidate report with you for
      <strong>${title}</strong>. It shows everyone in the pipeline — you can review
      profiles, leave comments, and mark candidates you'd like to move forward with.
    </p>
    <p style="margin:28px 0">
      <a href="${opts.url}"
         style="background:#8f917f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block">
        View the report
      </a>
    </p>
    <p style="font-size:12px;color:#8a8a8a;line-height:1.6">
      This link is private to invited reviewers. You'll be asked to confirm your
      email the first time you open it.
    </p>
  </div>`
  return { subject, html }
}
