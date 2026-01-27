import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const postingId = searchParams.get('postingId')

    // Fetch opportunities with applications to get posting info
    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=250&expand=contact&expand=stage&expand=applications',
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

    // Transform and optionally filter data
    let candidates = (data.data || []).map((opp: any) => {
      const app = opp.applications?.[0]
      return {
        id: opp.id,
        name: opp.contact?.name || 'Unknown',
        email: opp.contact?.emails?.[0] || '',
        position: app?.postingTitle || opp.name || 'No position',
        postingId: app?.posting || opp.id,
        stage: opp.stage?.text || 'Unknown Stage',
        createdAt: opp.createdAt,
      }
    })

    // Filter by posting if specified
    if (postingId) {
      candidates = candidates.filter((c: any) => c.postingId === postingId)
    }

    return NextResponse.json({ success: true, candidates })

  } catch (error: any) {
    console.error('Lever candidates error:', error)
    return NextResponse.json({
      error: 'Failed to load candidates',
      message: error.message
    }, { status: 500 })
  }
}
