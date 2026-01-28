import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'

const candidatesQuerySchema = z.object({
  postingId: z.string().max(100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      candidatesQuerySchema
    )
    if (validationError) return validationError

    const { postingId } = params

    let allOpportunities: any[] = []
    let nextCursor: string | undefined = undefined
    let hasMore = true
    let pageCount = 0
    const MAX_PAGES = postingId && postingId !== '__uncategorized__' ? 20 : 3

    // Build base parameters
    const baseParams = new URLSearchParams()
    baseParams.append('limit', '100')
    baseParams.append('expand', 'contact')
    baseParams.append('expand', 'stage')
    baseParams.append('expand', 'applications')

    if (postingId && postingId !== '__uncategorized__') {
      baseParams.append('posting_id', postingId)
    }

    // Pagination Loop
    while (hasMore && pageCount < MAX_PAGES) {
      const currentParams = new URLSearchParams(baseParams)
      if (nextCursor) {
        currentParams.append('offset', nextCursor)
      }

      const url = `https://api.lever.co/v1/opportunities?${currentParams.toString()}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Lever API error: ${response.status}`)
      }

      const data = await response.json()
      const pageOpportunities = data.data || []
      
      allOpportunities = [...allOpportunities, ...pageOpportunities]
      
      if (data.hasNext && data.next) {
        nextCursor = data.next
        pageCount++
      } else {
        hasMore = false
      }
    }
    
    // Transform data
    let candidates = allOpportunities.map((opp: any) => {
      const app = opp.applications?.[0]
      
      let matchedApp = app
      if (postingId && postingId !== '__uncategorized__' && opp.applications) {
         matchedApp = opp.applications.find((a: any) => a.posting === postingId) || app
      }

      const hasPosting = !!(matchedApp?.posting && matchedApp?.postingTitle)
      
      return {
        id: opp.id,
        name: opp.contact?.name || 'Unknown',
        email: opp.contact?.emails?.[0] || '',
        position: matchedApp?.postingTitle || 'Uncategorized',
        postingId: matchedApp?.posting || null,
        stage: opp.stage?.text || 'Unknown Stage',
        createdAt: opp.createdAt,
        isUncategorized: !hasPosting,
      }
    })

    // Filter by posting if specified
    if (postingId === '__uncategorized__') {
      candidates = candidates.filter((c: any) => c.isUncategorized)
    } else if (postingId) {
       candidates = candidates.filter((c: any) => c.postingId === postingId)
    }

    return NextResponse.json({ success: true, candidates })

  } catch (error) {
    return errorResponse(error, 'Lever candidates error')
  }
}
