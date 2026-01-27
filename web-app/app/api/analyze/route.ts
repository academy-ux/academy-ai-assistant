import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { transcript, meetingTitle, meetingDate } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    })

    const prompt = `You are analyzing an interview transcript for a recruiting team at Academy, a design-led recruiting and staffing business.

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
  "alternativeRatings": [
    {"rating": "alternative rating", "reasoning": "brief reason"}
  ]
}

Be objective. Focus on specific examples from the conversation.`

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

    return NextResponse.json({ success: true, analysis })

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      error: 'Analysis failed',
      message: error.message
    }, { status: 500 })
  }
}
