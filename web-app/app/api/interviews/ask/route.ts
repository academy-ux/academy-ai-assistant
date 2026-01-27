import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json()

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question)

    // Find relevant context from interviews
    const { data: similarInterviews, error: searchError } = await supabase
      .rpc('match_interviews', {
        query_embedding: questionEmbedding,
        match_threshold: 0.5,
        match_count: 5 // Get top 5 most relevant
      })

    if (searchError) throw searchError

    if (!similarInterviews || similarInterviews.length === 0) {
      return NextResponse.json({ 
        answer: "I couldn't find any relevant interviews to answer your question.",
        sources: [] 
      })
    }

    // Construct context for the LLM
    const context = similarInterviews.map((int: any) => 
      `Date: ${new Date(int.created_at).toLocaleDateString()}
       Candidate: ${int.candidate_name || 'Unknown'}
       Position: ${int.position || 'Unknown'}
       Transcript Excerpt: ${int.transcript.slice(0, 1000)}...`
    ).join('\n\n')

    // Ask Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const prompt = `You are an assistant analyzing interview transcripts. 
        
    Context from relevant interviews:
    ${context}
    
    User Question: ${question}
    
    Answer based ONLY on the provided context. If the answer isn't in the context, say so.
    Cite the candidate name when making specific claims.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const answerText = response.text()

    return NextResponse.json({
      answer: answerText,
      sources: similarInterviews.map((int: any) => ({
        id: int.id,
        candidateName: int.candidate_name,
        meetingDate: int.created_at,
        similarity: int.similarity
      }))
    })

  } catch (error: any) {
    console.error('Error asking question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
