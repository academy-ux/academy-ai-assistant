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
    // Note: RPC filter_types doesn't support owner_email yet, so we do client-side filtering for owner access
    const filterTypes = isUserAdmin ? null : ALLOWED_TYPES

    let results: any[] = []

    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(query)

      // Semantic search using vector similarity
      // For non-admins, we fetch more results and filter client-side to include owned meetings
      const fetchCount = isUserAdmin ? limit : limit * 3
      
      const { data: semanticResults, error: semanticError } = await supabase
        .rpc('match_interviews', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: fetchCount,
          filter_types: null // Fetch all, filter client-side to include owner access
        })

      if (semanticError) {
        // Fallback if RPC signature doesn't match
        console.warn('RPC match_interviews failed, falling back:', semanticError.message)
        
        const { data: fallbackResults, error: fallbackError } = await supabase
          .rpc('match_interviews', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: fetchCount
          })
        
        if (!fallbackError && fallbackResults) {
          results = fallbackResults
        } else {
          throw fallbackError || semanticError
        }
      } else {
        results = semanticResults || []
      }
      
      // Client-side filtering: non-admins can see allowed types OR their own meetings
      if (!isUserAdmin && userEmail) {
        results = results.filter((r: any) => {
          const isAllowedType = r.meeting_type && ALLOWED_TYPES.includes(r.meeting_type)
          const isOwner = r.owner_email === userEmail
          return isAllowedType || isOwner
        })
      }
      
      results = results.slice(0, limit)
    } 

    return NextResponse.json({ results })
  } catch (error) {
    return errorResponse(error, 'Error searching interviews')
  }
}
