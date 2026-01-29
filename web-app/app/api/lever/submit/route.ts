import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { leverSubmitSchema, validateBody, errorResponse } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY
    const leverUserId = process.env.LEVER_USER_ID

    if (!leverKey || !leverUserId) {
      return NextResponse.json({ error: 'Lever API not configured' }, { status: 500 })
    }

    const { data: body, error: validationError } = await validateBody(request, leverSubmitSchema)
    if (validationError) return validationError

    const { 
      opportunityId, 
      templateId, 
      fieldValues,
      feedback,
      transcript,
      meetingTitle,
      meetingCode,
      candidateName,
      position
    } = body

    // 1. Submit to Lever
    const response = await fetch(
      `https://api.lever.co/v1/opportunities/${encodeURIComponent(opportunityId)}/feedback?perform_as=${encodeURIComponent(leverUserId)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseTemplateId: templateId,
          fieldValues,
          createdAt: Date.now(),
          completedAt: Date.now(),
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Lever API error:', response.status, errorData)
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()

    // 2. Save to Supabase (update existing interview when possible)
    if (transcript) {
      try {
        const embedding = await generateEmbedding(transcript)

        const submittedAt = new Date().toISOString()

        // Prefer updating the existing transcript row (meetingCode is the interview id from the UI).
        let updated = false
        if (meetingCode) {
          const { data: updatedRows, error: updateError } = await supabase
            .from('interviews')
            .update({
              candidate_id: opportunityId,
              candidate_name: candidateName,
              position: position,
              rating: feedback.rating,
              summary: feedback.recommendation,
              embedding: embedding,
              submitted_at: submittedAt,
              updated_at: submittedAt,
            })
            .eq('id', meetingCode)
            .select('id')

          if (updateError) {
            console.error('Supabase update error:', updateError)
          } else if (updatedRows && updatedRows.length > 0) {
            updated = true
          }
        }

        // Fallback for older flows: create a record if we couldn't update.
        if (!updated) {
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
              summary: feedback.recommendation,
              embedding: embedding,
              submitted_at: submittedAt,
            })

          if (dbError) {
            console.error('Supabase insertion error:', dbError)
          }
        }
      } catch (innerError) {
        console.error('Error saving to Supabase:', innerError)
        // Don't fail the whole request if Supabase fails, since Lever succeeded
      }
    }

    return NextResponse.json({ success: true, data })

  } catch (error) {
    return errorResponse(error, 'Lever submit error')
  }
}
