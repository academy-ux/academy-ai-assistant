import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { analyzeSchema, validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    // Rate limit AI endpoints (expensive)
    const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
    if (!success && rateLimitResponse) return rateLimitResponse

    const { data: body, error: validationError } = await validateBody(request, analyzeSchema)
    if (validationError) return validationError

    const { transcript, meetingTitle, meetingDate, template } = body

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    })

    // Construct prompt based on whether we have a specific template or not
    let prompt = ''
    
    if (template && template.fields && template.fields.length > 0) {
       // Dynamic Template Prompt
       const fieldDescriptions = template.fields.map((f: any) => {
         const type = String(f.type || '').toLowerCase()
         let typeHint = ''
         
         if (type === 'yes-no') {
           typeHint = ' [Answer with ONLY "yes", "no", or "?" - do not provide explanations]'
         } else if (type === 'score') {
           typeHint = ' [Answer with a single number: 1, 2, 3, or 4 only]'
         } else if (type === 'score-system' || type === 'dropdown') {
           typeHint = ' [Choose the most appropriate option from the provided choices]'
         } else if (type === 'textarea' || type === 'text') {
           typeHint = ' [Provide a detailed answer based on the transcript]'
         }
         
         return `- "${f.question}"${typeHint}${f.description ? ` (${f.description})` : ''}`
       }).join('\n')
       
       prompt = `You are analyzing an interview transcript for a recruiting team at Academy.
       
Meeting: ${meetingTitle || 'Interview'}
Date: ${meetingDate || 'Today'}

Transcript:
${transcript}

Analyze this interview and fill out the following feedback form.

Return ONLY valid JSON in the following exact shape (no markdown, no extra keys):
{
  "candidateName": "string or null",
  "answers": {
    "<question text>": "<answer text>",
    "...": "..."
  }
}

Form Fields to Fill:
${fieldDescriptions}

CRITICAL Guidelines by Field Type:
- YES/NO questions: Answer with ONLY "yes", "no", or "?" - never provide explanations or details
- SCORE questions (1-4): Answer with ONLY the number: 1, 2, 3, or 4
- RATING/DROPDOWN questions: Pick ONE option that best matches the transcript
- TEXT questions: Provide detailed answers citing specific examples

General Guidelines:
- The keys inside "answers" MUST match the question text exactly, including punctuation/casing.
- Be objective and base answers strictly on information in the transcript.
- If you cannot determine the answer from the transcript, use "?".
- NEVER include timestamps or time ranges in your answers (e.g. no "(17:13-17:16)").`
    } else {
       // Default Legacy Prompt
       prompt = `You are analyzing an interview transcript for a recruiting team at Academy, a design-led recruiting and staffing business.

Meeting: ${meetingTitle || 'Interview'}
Date: ${meetingDate || 'Today'}

Transcript:
${transcript}

Analyze this interview and provide structured feedback in this exact JSON format:
{
  "rating": "one of: 4 - Strong Hire, 3 - Hire, 2 - No Hire, 1 - Strong No Hire",
  "strengths": "2-3 sentences about key strengths demonstrated",
  "concerns": "2-3 sentences about concerns or areas for improvement",
  "technicalSkills": "List of technical skills, tools, or frameworks mentioned",
  "culturalFit": "Brief assessment of cultural fit and soft skills",
  "recommendation": "Clear recommendation on next steps",
  "keyQuotes": ["notable quote 1", "notable quote 2", "notable quote 3"],
  "candidateName": "extracted candidate name if mentioned, or null",
  "answers": null
}

Be objective. Focus on specific examples from the conversation.`
    }

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse JSON from response
    let analysis
    try {
      analysis = JSON.parse(text)
    } catch (e) {
      // Try to extract JSON if parsing fails
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse analysis response')
      }
    }

    // Post-process: strip timestamp references if the model included any
    const stripTimestamps = (s: string) => {
      // Remove parenthetical timestamp ranges like "(17:13-17:16, 31:47-31:49)"
      let out = s.replace(
        /\(\s*\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?(?:\s*,\s*\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?)*\s*\)/g,
        ''
      )
      // Remove standalone timestamp ranges like "17:13-17:16"
      out = out.replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/g, '')
      // Remove standalone timestamps like "17:13"
      out = out.replace(/\b\d{1,2}:\d{2}\b/g, '')
      // Clean up whitespace/punctuation spacing
      out = out.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\s+,/g, ',').trim()
      return out
    }

    const cleanAnalysis = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj
      // Clean dynamic template output
      if (obj.answers && typeof obj.answers === 'object' && !Array.isArray(obj.answers)) {
        const nextAnswers: Record<string, any> = {}
        for (const [k, v] of Object.entries(obj.answers)) {
          nextAnswers[k] = typeof v === 'string' ? stripTimestamps(v) : v
        }
        return { ...obj, answers: nextAnswers }
      }
      // Clean legacy output fields if present
      const next: any = { ...obj }
      for (const key of ['strengths', 'concerns', 'technicalSkills', 'culturalFit', 'recommendation']) {
        if (typeof next[key] === 'string') next[key] = stripTimestamps(next[key])
      }
      return next
    }

    return NextResponse.json({ success: true, analysis: cleanAnalysis(analysis) })

  } catch (error) {
    return errorResponse(error, 'Analysis error')
  }
}
