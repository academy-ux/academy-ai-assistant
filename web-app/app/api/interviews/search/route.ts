export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { searchQuerySchema, validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkForAbuse } from '@/lib/abuse-detection'

// Allowed meeting types for non-admins
const ALLOWED_TYPES = ['Status Update', 'Client Call', 'Interview']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email
    const isUserAdmin = isAdmin(userEmail)

    // Rate limit search endpoints — user-level
    const { success, response: rateLimitResponse } = await checkRateLimit(request, 'search', userEmail || undefined)
    if (!success && rateLimitResponse) return rateLimitResponse

    const { data: body, error: validationError } = await validateBody(request, searchQuerySchema)
    if (validationError) return validationError

    const { query, limit } = body

    // Abuse detection
    if (userEmail) {
      const abuse = await checkForAbuse({
        userEmail,
        userName: session?.user?.name || undefined,
        endpoint: '/api/interviews/search',
        query,
        isAdmin: isUserAdmin,
      })
      if (abuse.blocked) {
        return NextResponse.json({ error: abuse.reason }, { status: 403 })
      }
    }

    // Use PostgreSQL full-text search via RPC
    const { data: results, error: searchError } = await supabase
      .rpc('search_interviews', {
        search_query: query,
        match_limit: limit * 2,
      })

    if (searchError) {
      console.error('Full-text search error:', searchError)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    let filtered = results || []

    // Apply permission filters
    if (!isUserAdmin && userEmail) {
      filtered = filtered.filter((r: any) => {
        const isAllowedType = r.meeting_type && ALLOWED_TYPES.includes(r.meeting_type)
        const isOwner = r.owner_email === userEmail
        return isAllowedType || isOwner || !r.owner_email
      })
    }

    // Limit final results
    filtered = filtered.slice(0, limit)

    return NextResponse.json({ results: filtered })
  } catch (error) {
    return errorResponse(error, 'Error searching interviews')
  }
}
