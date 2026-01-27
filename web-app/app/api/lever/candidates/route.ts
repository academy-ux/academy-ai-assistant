import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const postingId = searchParams.get('postingId')

    // Fetch ALL opportunities (not just active) with applications to get posting info
    // archived=false gets active candidates in the pipeline
    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=500&expand=contact&expand=stage&expand=applications&archived=false',
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
