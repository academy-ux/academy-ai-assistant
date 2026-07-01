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

// ============================================
// System / Operational Alert
// ============================================

interface SystemAlertParams {
  title: string
  severity?: 'warning' | 'critical'
  details: Record<string, unknown>
}

/**
 * Fire an operational alert to Slack for background/system problems (as opposed
 * to per-user abuse). Reuses the same webhook. Use this for unattended failures
 * — e.g. the Drive poll cron degrading — so they surface in hours, not weeks.
 * Best-effort: never throws, so it can't take down the job it's reporting on.
 */
export async function sendSystemAlert(params: SystemAlertParams): Promise<void> {
  const webhookUrl = process.env.SLACK_ABUSE_ALERT_WEBHOOK
  if (!webhookUrl) {
    console.warn('[Alert] SLACK_ABUSE_ALERT_WEBHOOK not configured, skipping system alert')
    return
  }

  const severity = params.severity ?? 'warning'
  const emoji = severity === 'critical' ? '🚨' : '⚠️'

  const detailFields = Object.entries(params.details)
    .slice(0, 8)
    .map(([key, value]) => ({
      type: 'mrkdwn' as const,
      text: `*${key}:*\n${typeof value === 'string' ? value : JSON.stringify(value)}`,
    }))

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} System Alert — ${params.title}` },
      },
      ...(detailFields.length > 0
        ? [{ type: 'section', fields: detailFields }]
        : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Time: ${new Date().toISOString()}` }],
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
      console.error('[Alert] System alert webhook failed:', response.status, await response.text())
    }
  } catch (error) {
    console.error('[Alert] System alert webhook error:', error)
  }
}
