import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { askQuestionSchema, validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Check if question is asking about recent/last interviews
function isTemporalQuestion(question: string): boolean {
  const temporalKeywords = [
    'last', 'recent', 'latest', 'most recent', 'previous', 
    'yesterday', 'today', 'this week', 'this month',
    'how many', 'count', 'total'
  ]
  const lowerQ = question.toLowerCase()
  return temporalKeywords.some(keyword => lowerQ.includes(keyword))
}

// Extract number from question like "last 4" or "last four"
function extractCount(question: string): number {
  const numberWords: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  }
  
  // Check for digit
  const digitMatch = question.match(/\b(\d+)\b/)
  if (digitMatch) return Math.min(parseInt(digitMatch[1]), 20)
  
  // Check for word number
  const lowerQ = question.toLowerCase()
  for (const [word, num] of Object.entries(numberWords)) {
    if (lowerQ.includes(word)) return num
  }
  
  return 5 // default
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit AI endpoints (expensive)
    const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
    if (!success && rateLimitResponse) return rateLimitResponse

    const { data: body, error: validationError } = await validateBody(request, askQuestionSchema)
    if (validationError) return validationError

    const { question, history, interviewId } = body

    let interviews: any[] = []
    
    // If a specific interview ID is provided, focus on that interview
    if (interviewId) {
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single()
      
      if (interviewError) throw interviewError
      if (interview) interviews = [interview]
    }
    // Check if this is a temporal/count question
    else if (isTemporalQuestion(question)) {
      const count = extractCount(question)
      
      // Get recent interviews by date
      const { data: recentInterviews, error: recentError } = await supabase
        .from('interviews')
        .select('*')
        .order('meeting_date', { ascending: false })
        .limit(Math.min(count, 20))
      
      if (recentError) throw recentError
      interviews = recentInterviews || []
    } else {
      // Use semantic search for other questions
      try {
        const questionEmbedding = await generateEmbedding(question)

        const { data: similarInterviews, error: searchError } = await supabase
          .rpc('match_interviews', {
            query_embedding: questionEmbedding,
            match_threshold: 0.3,
            match_count: 10
          })

        if (searchError) {
          console.error('Semantic search error:', searchError)
        } else {
          interviews = similarInterviews || []
        }
      } catch (embeddingError) {
        console.error('Embedding generation error:', embeddingError)
      }
      
      // Fallback: if semantic search failed or returned nothing
      if (interviews.length === 0) {
        const { data: fallbackInterviews, error: fallbackError } = await supabase
          .from('interviews')
          .select('*')
          .order('meeting_date', { ascending: false })
          .limit(10)
        
        if (!fallbackError && fallbackInterviews) {
          interviews = fallbackInterviews
        }
      }
    }

    if (!interviews || interviews.length === 0) {
      return NextResponse.json({ 
        answer: "I couldn't find any interviews in your database. Try importing some transcripts first.",
        sources: [] 
      })
    }

    // Construct context for the LLM
    const isSingleInterview = interviews.length === 1
    const context = interviews.map((int: any, idx: number) => 
      `Interview ${idx + 1}:
       Date: ${new Date(int.meeting_date || int.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
       Candidate: ${int.candidate_name || 'Unknown'}
       Interviewer: ${int.interviewer || 'Unknown'}
       Meeting Type: ${int.meeting_title || 'Interview'}
       Position: ${int.position || 'Not specified'}
       Summary: ${int.summary || 'No summary available'}
       ${isSingleInterview 
         ? `Full Transcript:\n${int.transcript || 'No transcript'}`
         : `Transcript Excerpt: ${int.transcript?.slice(0, 800) || 'No transcript'}...`
       }`
    ).join('\n\n---\n\n')

    // Build conversation history for context
    const conversationContext = history.length > 0 
      ? `\n\nPrevious conversation:\n${history.map((msg: {role: string, content: string}) => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n')}\n\n`
      : ''

    // Ask Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const prompt = `You are an AI assistant helping analyze interview data. You have access to the following interviews:

${context}
${conversationContext}
Current User Question: ${question}

Instructions:
- Answer the question directly and concisely based on the interview data above
- If this is a follow-up question, use the conversation context to understand what the user is referring to
- If asking about specific people, list their names
- If asking about counts, give the exact number
- If asking for comparisons, highlight key differences
- Format your response nicely with bullet points or lists when appropriate
- Be specific and cite names when relevant
- If the user asks "tell me more" or similar, elaborate on your previous response`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const answerText = response.text()

    return NextResponse.json({
      answer: answerText,
      sources: interviews.slice(0, 5).map((int: any) => ({
        id: int.id,
        candidateName: int.candidate_name || 'Unknown',
        meetingDate: int.meeting_date || int.created_at,
        similarity: int.similarity
      }))
    })

  } catch (error) {
    return errorResponse(error, 'Error asking question')
  }
}
