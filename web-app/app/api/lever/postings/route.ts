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
    let uncategorizedCount = 0
    
    for (const opp of data.data || []) {
      // Get position info - first check applications, then fallback to opportunity itself
      const app = opp.applications?.[0]
      const postingId = app?.posting
      const postingText = app?.postingTitle
      
      if (postingId && postingText) {
        // Has a real posting
        if (positionMap.has(postingId)) {
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
      } else {
        // Uncategorized - no posting associated
        uncategorizedCount++
      }
    }

    // Build postings array with uncategorized at top if any exist
    const postings: any[] = []
    
    if (uncategorizedCount > 0) {
      postings.push({
        id: '__uncategorized__',
        text: 'Uncategorized',
        team: '',
        location: '',
        count: uncategorizedCount,
        isUncategorized: true
      })
    }
    
    // Add regular postings sorted by count
    const regularPostings = Array.from(positionMap.values())
      .sort((a, b) => b.count - a.count)
    
    postings.push(...regularPostings)
    
    console.log('Positions extracted:', postings.length, 'Uncategorized:', uncategorizedCount)
    
    return NextResponse.json({ success: true, postings })

  } catch (error: any) {
    console.error('Lever postings error:', error)
    return NextResponse.json({
      error: 'Failed to load postings',
      message: error.message
    }, { status: 500 })
  }
}
