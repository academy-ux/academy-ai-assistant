import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    // Fetch opportunities to extract unique positions
    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=250&expand=applications',
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
    
    // Extract unique positions from opportunities
    const positionMap = new Map<string, { id: string; text: string; team: string; location: string; count: number }>()
    
    for (const opp of data.data || []) {
      // Get position info - first check applications, then fallback to opportunity itself
      const app = opp.applications?.[0]
      const postingId = app?.posting || opp.id
      const postingText = app?.postingTitle || opp.name || 'General Application'
      
      if (positionMap.has(postingId)) {
        // Increment count for this position
        const existing = positionMap.get(postingId)!
        existing.count++
      } else {
        positionMap.set(postingId, {
          id: postingId,
          text: postingText,
          team: '',
          location: '',
          count: 1
        })
      }
    }

    const postings = Array.from(positionMap.values())
      .sort((a, b) => b.count - a.count) // Most candidates first
    
    console.log('Positions extracted from opportunities:', postings.length)
    
    return NextResponse.json({ success: true, postings })

  } catch (error: any) {
    console.error('Lever postings error:', error)
    return NextResponse.json({
      error: 'Failed to load postings',
      message: error.message
    }, { status: 500 })
  }
}
