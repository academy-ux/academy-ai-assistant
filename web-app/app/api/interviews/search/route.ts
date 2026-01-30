import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { searchQuerySchema, validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

// Allowed meeting types for non-admins
const ALLOWED_TYPES = ['Status Update', 'Client Call', 'Interview']

export async function POST(request: NextRequest) {
  try {
    // Rate limit search endpoints
    const { success, response: rateLimitResponse } = await checkRateLimit(request, 'search')
    if (!success && rateLimitResponse) return rateLimitResponse

    const { data: body, error: validationError } = await validateBody(request, searchQuerySchema)
    if (validationError) return validationError

    const { query, searchType, limit } = body
    
    // Check user permissions
    const session = await getServerSession(authOptions)
    const isUserAdmin = isAdmin(session?.user?.email)
    const userEmail = session?.user?.email

    let results: any[] = []
    let keywordResults: any[] = []
    let semanticResults: any[] = []

    // Keyword search (exact text matching)
    if (searchType === 'keyword' || searchType === 'hybrid') {
      const searchPattern = `%${query}%`
      
      let keywordQuery = supabase
        .from('interviews')
        .select('*, similarity:1') // Add dummy similarity for consistent interface
        .or(`candidate_name.ilike.${searchPattern},position.ilike.${searchPattern},meeting_title.ilike.${searchPattern},transcript.ilike.${searchPattern}`)
        .limit(limit * 2)

      const { data: kwResults, error: kwError } = await keywordQuery

      if (!kwError && kwResults) {
        keywordResults = kwResults.map(r => ({ ...r, searchType: 'keyword' }))
      }
    }

    // Semantic search (vector similarity)
    if (searchType === 'semantic' || searchType === 'hybrid') {
      try {
        const queryEmbedding = await generateEmbedding(query)
        const fetchCount = limit * 2
        
        const { data: semResults, error: semanticError } = await supabase
          .rpc('match_interviews', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: fetchCount,
            filter_types: null
          })

        if (!semanticError && semResults) {
          semanticResults = semResults.map((r: any) => ({ ...r, searchType: 'semantic' }))
        }
      } catch (err) {
        console.warn('Semantic search failed, using keyword results only:', err)
      }
    }

    // Combine results for hybrid search
    if (searchType === 'hybrid') {
      // Merge results, prioritizing keyword matches
      const seenIds = new Set<string>()
      
      // Add keyword results first (they're more relevant for exact matches)
      for (const result of keywordResults) {
        if (!seenIds.has(result.id)) {
          results.push({ ...result, hybrid: true, keywordMatch: true })
          seenIds.add(result.id)
        }
      }
      
      // Then add semantic results that aren't duplicates
      for (const result of semanticResults) {
        if (!seenIds.has(result.id) && results.length < limit * 2) {
          results.push({ ...result, hybrid: true, keywordMatch: false })
          seenIds.add(result.id)
        }
      }
    } else if (searchType === 'keyword') {
      results = keywordResults
    } else {
      results = semanticResults
    }
    
    // Apply permission filters
    if (!isUserAdmin && userEmail) {
      results = results.filter((r: any) => {
        const isAllowedType = r.meeting_type && ALLOWED_TYPES.includes(r.meeting_type)
        const isOwner = r.owner_email === userEmail
        return isAllowedType || isOwner || !r.owner_email
      })
    }
    
    // Limit final results
    results = results.slice(0, limit)

    return NextResponse.json({ results })
  } catch (error) {
    return errorResponse(error, 'Error searching interviews')
  }
}
