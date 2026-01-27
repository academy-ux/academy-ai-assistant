import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY
    const leverUserId = process.env.LEVER_USER_ID

    if (!leverKey || !leverUserId) {
      return NextResponse.json({ error: 'Lever API not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { 
      opportunityId, 
      templateId, 
      feedback,
      // Extra fields for Supabase
      transcript,
      meetingTitle,
      meetingCode,
      candidateName,
      position
    } = body

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

    // 1. Submit to Lever
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

    // 2. Save to Supabase (Fire and forget, or await? Await is safer for now)
    if (transcript) {
      try {
        // Generate embedding
        const embedding = await generateEmbedding(transcript)

        const { error: dbError } = await supabase
          .from('interviews')
          .insert({
            meeting_code: meetingCode,
            meeting_title: meetingTitle,
            meeting_date: new Date().toISOString(),
            candidate_id: opportunityId,
            candidate_name: candidateName,
            position: position,
            transcript: transcript,
            rating: feedback.rating,
            summary: feedback.recommendation, // Use recommendation as summary for now
            embedding: embedding
          })

        if (dbError) {
          console.error('Supabase insertion error:', dbError)
        }
      } catch (innerError) {
        console.error('Error saving to Supabase:', innerError)
        // Don't fail the whole request if Supabase fails, since Lever succeeded
      }
    }

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    console.error('Lever submit error:', error)
    return NextResponse.json({
      error: 'Failed to submit feedback',
      message: error.message
    }, { status: 500 })
  }
}
