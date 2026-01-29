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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'submit/route.ts:49',message:'fieldValues with question marks',data:{questionMarkFields:Array.isArray(fieldValues)?fieldValues.filter((fv:any)=>fv?.value==='?').map((fv:any)=>fv?.id):[],allFieldValues:Array.isArray(fieldValues)?fieldValues.map((fv:any)=>({id:fv?.id,valuePreview:typeof fv?.value==='string'?fv.value.slice(0,30):fv?.value})):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

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

          const templateData = (templateRes as any)?.data
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'submit/route.ts:75',message:'templateRes structure',data:{hasData:!!templateData,dataKeys:templateData?Object.keys(templateData):null,hasNestedData:!!(templateData as any)?.data,nestedDataKeys:(templateData as any)?.data?Object.keys((templateData as any).data):null,fieldsAtRoot:Array.isArray(templateData?.fields),fieldsNested:Array.isArray((templateData as any)?.data?.fields)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Fix: Lever wraps response in { data: { ... } }, so fields are at data.data.fields
          const actualTemplateData = templateData?.data || templateData
          const templateFields = Array.isArray(actualTemplateData?.fields) ? actualTemplateData.fields : []
          const templateFieldIds = templateFields.map((f: any) => f?.id).filter(Boolean)
          const requiredFieldIds = templateFields.filter((f: any) => !!f?.required || String(f?.type || '').toLowerCase() === 'score-system').map((f: any) => f?.id).filter(Boolean)
          const submittedIds = Array.isArray(fieldValues) ? fieldValues.map((fv: any) => fv?.id).filter(Boolean) : []
          const missingRequired = requiredFieldIds.filter((id: any) => !submittedIds.includes(id))
          const unknownSubmitted = submittedIds.filter((id: any) => templateFieldIds.length > 0 && !templateFieldIds.includes(id))
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'submit/route.ts:85',message:'template fields analysis',data:{templateFieldCount:templateFields.length,templateFieldIds,requiredFieldIds,submittedIds,missingRequired,unknownSubmitted,scoreFields:templateFields.filter((f:any)=>f?.type==='score-system').map((f:any)=>({id:f.id,text:f.text,options:f.options}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
          // #endregion

          // Build field type map and check for invalid values
          const fieldTypeMap = templateFields.reduce((acc: any, f: any) => {
            acc[f.id] = { type: f.type, text: f.text, required: f.required, options: f.options };
            return acc;
          }, {});
          
          // Check each submitted value against its field type
          const fieldValueIssues = Array.isArray(fieldValues) ? fieldValues.map((fv: any) => {
            const fieldDef = fieldTypeMap[fv.id];
            if (!fieldDef) return { id: fv.id, issue: 'unknown_field' };
            const issues = [];
            // Check if ? is sent for option-based fields
            if (fv.value === '?' && (fieldDef.type === 'score-system' || fieldDef.type === 'yes-no' || fieldDef.type === 'dropdown')) {
              issues.push('question_mark_for_option_field');
            }
            // Check if score-system value matches options
            if (fieldDef.type === 'score-system' && fieldDef.options && fv.value !== '?') {
              const validOptions = fieldDef.options.map((o: any) => o.text || o);
              if (!validOptions.includes(fv.value)) {
                issues.push(`invalid_score_option: got "${fv.value}", valid: ${JSON.stringify(validOptions)}`);
              }
            }
            return issues.length > 0 ? { id: fv.id, type: fieldDef.type, text: fieldDef.text, value: typeof fv.value === 'string' ? fv.value.slice(0, 50) : fv.value, issues } : null;
          }).filter(Boolean) : [];

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
              fields: templateFields.map((f: any) => ({ id: f.id, type: f.type, text: (f.text || '').slice(0, 40), required: !!f.required })),
            },
            opportunity: { id: opportunityId, ok: oppRes.ok, status: oppRes.status },
            fieldValueIssues,
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
