// ============================================
// Abuse Alert System — Slack Webhook
// ============================================

interface AbuseAlertParams {
  userEmail: string
  userName?: string
  eventType: string
  severity: string
  endpoint: string
  details: Record<string, unknown>
}

// ============================================
// Slack Webhook Alert
// ============================================

export async function sendAbuseAlert(params: AbuseAlertParams): Promise<void> {
  const webhookUrl = process.env.SLACK_ABUSE_ALERT_WEBHOOK
  if (!webhookUrl) {
    console.warn('[Alert] SLACK_ABUSE_ALERT_WEBHOOK not configured, skipping alert')
    return
  }

  const severityEmoji = params.severity === 'critical' ? '🚨' : params.severity === 'blocked' ? '🔒' : '⚠️'
  const reason = (params.details.reason as string) || 'Unknown'
  const query = params.details.query ? `\n>Query: _"${params.details.query}"_` : ''

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} Abuse Alert — ${params.severity.toUpperCase()}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*User:*\n${params.userName || 'Unknown'} (${params.userEmail})` },
          { type: 'mrkdwn', text: `*Event:*\n${params.eventType}` },
          { type: 'mrkdwn', text: `*Endpoint:*\n\`${params.endpoint}\`` },
          { type: 'mrkdwn', text: `*Time:*\n${new Date().toISOString()}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reason:* ${reason}${query}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: params.severity === 'critical'
              ? '🔒 User has been *automatically restricted*. Unrestrict via admin API.'
              : '⚠️ User has been flagged but not restricted.',
          },
        ],
      },
    ],
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('[Alert] Slack webhook failed:', response.status, await response.text())
    }
  } catch (error) {
    console.error('[Alert] Slack webhook error:', error)
  }
}
