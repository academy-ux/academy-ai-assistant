import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { query, searchType = 'hybrid', limit = 20 } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    let results: any[] = []

    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query)

      // Semantic search using vector similarity
      // Note: match_interviews function must exist in Supabase
      const { data: semanticResults, error: semanticError } = await supabase
        .rpc('match_interviews', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5, // Adjust threshold as needed
          match_count: limit
        })

      if (semanticError) throw semanticError
      results = semanticResults || []
    } 
    
    // If we wanted to add keyword search or hybrid logic, we could do it here
    // For now, we'll stick to the semantic results from the vector store

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Error searching interviews:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
