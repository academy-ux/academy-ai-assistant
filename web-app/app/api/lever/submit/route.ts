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

    const leverHeaders = {
      'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    } as const

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
    const payload = {
      baseTemplateId: templateId,
      fieldValues,
      createdAt: Date.now(),
      completedAt: Date.now(),
    }

    console.log('[Lever submit]', {
      opportunityId,
      templateId,
      fieldValuesCount: Array.isArray(fieldValues) ? fieldValues.length : null,
      fieldValueIdsPreview: Array.isArray(fieldValues) ? fieldValues.slice(0, 8).map((fv: any) => fv?.id).filter(Boolean) : null,
    })

    const response = await fetch(
      `https://api.lever.co/v1/opportunities/${encodeURIComponent(opportunityId)}/feedback?perform_as=${encodeURIComponent(leverUserId)}`,
      {
        method: 'POST',
        headers: leverHeaders,
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorText = errorData ? null : await response.text().catch(() => null)
      console.error('Lever API error:', response.status, errorData || errorText)

      // Extra diagnostics for the generic "Unable to create feedback" error.
      let diagnostics: any = null
      try {
        if (response.status === 400) {
          const [userRes, templateRes, oppRes] = await Promise.all([
            fetch(`https://api.lever.co/v1/users/${encodeURIComponent(leverUserId)}`, { headers: leverHeaders }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => null) })).catch((e) => ({ ok: false, status: -1, error: String(e) })),
            fetch(`https://api.lever.co/v1/feedback_templates/${encodeURIComponent(templateId)}`, { headers: leverHeaders }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => null) })).catch((e) => ({ ok: false, status: -1, error: String(e) })),
            fetch(`https://api.lever.co/v1/opportunities/${encodeURIComponent(opportunityId)}`, { headers: leverHeaders }).then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => null) })).catch((e) => ({ ok: false, status: -1, error: String(e) })),
          ])

          const templateFields = Array.isArray(templateRes?.data?.fields) ? templateRes.data.fields : []
          const templateFieldIds = templateFields.map((f: any) => f?.id).filter(Boolean)
          const requiredFieldIds = templateFields.filter((f: any) => !!f?.required || String(f?.type || '').toLowerCase() === 'score-system').map((f: any) => f?.id).filter(Boolean)
          const submittedIds = Array.isArray(fieldValues) ? fieldValues.map((fv: any) => fv?.id).filter(Boolean) : []
          const missingRequired = requiredFieldIds.filter((id: any) => !submittedIds.includes(id))
          const unknownSubmitted = submittedIds.filter((id: any) => templateFieldIds.length > 0 && !templateFieldIds.includes(id))

          diagnostics = {
            performAsUser: { id: leverUserId, ok: userRes.ok, status: userRes.status },
            template: {
              id: templateId,
              ok: templateRes.ok,
              status: templateRes.status,
              fieldCount: templateFieldIds.length,
              requiredFieldCount: requiredFieldIds.length,
              missingRequiredFieldIds: missingRequired,
              unknownSubmittedFieldIds: unknownSubmitted,
            },
            opportunity: { id: opportunityId, ok: oppRes.ok, status: oppRes.status },
          }
        }
      } catch (e) {
        diagnostics = { error: String(e) }
      }

      const leverMessage =
        (errorData && typeof errorData === 'object' && 'message' in errorData && typeof (errorData as any).message === 'string')
          ? (errorData as any).message
          : (errorText || `Lever API error: ${response.status}`)

      const leverCode =
        (errorData && typeof errorData === 'object' && 'code' in errorData && typeof (errorData as any).code === 'string')
          ? (errorData as any).code
          : undefined

      return NextResponse.json(
        {
          success: false,
          error: leverCode ? `${leverCode}: ${leverMessage}` : leverMessage,
          details: {
            lever: errorData || errorText,
            sent: {
              opportunityId,
              templateId,
              payload,
              performAs: leverUserId,
            },
            diagnostics,
          },
        },
        { status: response.status }
      )
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
