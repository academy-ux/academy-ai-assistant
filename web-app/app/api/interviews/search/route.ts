import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { searchQuerySchema, validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit search endpoints
    const { success, response: rateLimitResponse } = await checkRateLimit(request, 'search')
    if (!success && rateLimitResponse) return rateLimitResponse

    const { data: body, error: validationError } = await validateBody(request, searchQuerySchema)
    if (validationError) return validationError

    const { query, searchType, limit } = body

    let results: any[] = []

    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query)

      // Semantic search using vector similarity
      const { data: semanticResults, error: semanticError } = await supabase
        .rpc('match_interviews', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: limit
        })

      if (semanticError) throw semanticError
      results = semanticResults || []
    } 

    return NextResponse.json({ results })
  } catch (error) {
    return errorResponse(error, 'Error searching interviews')
  }
}
