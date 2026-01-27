import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY
    const leverUserId = process.env.LEVER_USER_ID

    if (!leverKey || !leverUserId) {
      return NextResponse.json({ error: 'Lever API not configured' }, { status: 500 })
    }

    const { opportunityId, templateId, feedback } = await request.json()

    if (!opportunityId || !templateId || !feedback) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Format feedback text
    const feedbackText = `
Rating: ${feedback.rating}

Strengths:
${feedback.strengths}

Concerns:
${feedback.concerns}

Technical Skills:
${feedback.technicalSkills}

Cultural Fit:
${feedback.culturalFit}

Recommendation:
${feedback.recommendation}
    `.trim()

    const response = await fetch(
      `https://api.lever.co/v1/opportunities/${opportunityId}/feedback?perform_as=${leverUserId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseTemplateId: templateId,
          text: feedbackText,
          completedAt: Date.now(),
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Lever API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    console.error('Lever submit error:', error)
    return NextResponse.json({
      error: 'Failed to submit feedback',
      message: error.message
    }, { status: 500 })
  }
}
