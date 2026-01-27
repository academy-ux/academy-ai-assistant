import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const postingId = searchParams.get('postingId')

    let url = 'https://api.lever.co/v1/opportunities?limit=100&expand=contact&expand=stage&expand=applications'
    
    // If a specific posting is requested, filter at the API level for better results
    if (postingId && postingId !== '__uncategorized__') {
      url += `&posting_id=${postingId}`
    } else {
        // If no posting ID, we might need to paginate to get everyone if > 100
        // For now, let's just assume 100 is enough for "uncategorized" checks or general lists
    }

    const response = await fetch(
      url,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Total opportunities fetched:', data.data?.length || 0)
    
    // Log unique stages for debugging
    const stages = new Set((data.data || []).map((opp: any) => opp.stage?.text).filter(Boolean))
    console.log('Stages found:', Array.from(stages))

    // Transform and optionally filter data
    let candidates = (data.data || []).map((opp: any) => {
      const app = opp.applications?.[0]
      const hasPosting = !!(app?.posting && app?.postingTitle)
      
      return {
        id: opp.id,
        name: opp.contact?.name || 'Unknown',
        email: opp.contact?.emails?.[0] || '',
        position: app?.postingTitle || 'Uncategorized',
        postingId: app?.posting || null,
        stage: opp.stage?.text || 'Unknown Stage',
        createdAt: opp.createdAt,
        isUncategorized: !hasPosting,
      }
    })

    // Filter by posting if specified
    if (postingId === '__uncategorized__') {
      // Show only uncategorized candidates
      candidates = candidates.filter((c: any) => c.isUncategorized)
    } else if (postingId) {
      // Show candidates for specific posting
      // Since we filter at API level, this client-side filter is just a safety check
      // But we MUST NOT filter out by stage unless asked. The user wants ALL stages.
      // candidates = candidates.filter((c: any) => c.postingId === postingId)
      // Actually, since we use posting_id param in API, all returned results ARE for this posting.
      // But let's keep the safety check but ensure we aren't filtering out valid candidates.
      candidates = candidates.filter((c: any) => c.postingId === postingId)
    }

    console.log('Candidates after filtering for posting', postingId, ':', candidates.length)

    return NextResponse.json({ success: true, candidates })

  } catch (error: any) {
    console.error('Lever candidates error:', error)
    return NextResponse.json({
      error: 'Failed to load candidates',
      message: error.message
    }, { status: 500 })
  }
}
