import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MAX_FILE_SIZE, ALLOWED_AUDIO_TYPES, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    // Rate limit upload endpoints
    const { success, response: rateLimitResponse } = await checkRateLimit(req, 'upload')
    if (!success && rateLimitResponse) return rateLimitResponse

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed types: ' + ALLOWED_AUDIO_TYPES.join(', ') 
      }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: file.type || 'audio/webm',
          data: base64Audio
        }
      },
      { text: "Transcribe this audio exactly as it is spoken. Do not add any commentary, prefixes, or markdown." }
    ])

    const response = await result.response
    const text = response.text()

    return NextResponse.json({ text })
  } catch (error) {
    return errorResponse(error, 'Transcription error')
  }
}
