import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    // First, try to fetch actual job postings (only published/active ones)
    const postingsResponse = await fetch(
      'https://api.lever.co/v1/postings?state=published',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const postings: any[] = []

    if (postingsResponse.ok) {
      const postingsData = await postingsResponse.json()
      
      // Use actual job postings if available (already filtered to published)
      for (const posting of postingsData.data || []) {
        postings.push({
          id: posting.id,
          text: posting.text,
          team: posting.categories?.team || '',
          location: posting.categories?.location || '',
          state: posting.state,
        })
      }
    }

    // If we have postings, return them
    if (postings.length > 0) {
      // Get candidate counts per posting
      const oppsResponse = await fetch(
        'https://api.lever.co/v1/opportunities?limit=500&expand=applications',
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (oppsResponse.ok) {
        const oppsData = await oppsResponse.json()
        const countMap = new Map<string, number>()

        for (const opp of oppsData.data || []) {
          const postingId = opp.applications?.[0]?.posting
          if (postingId) {
            countMap.set(postingId, (countMap.get(postingId) || 0) + 1)
          }
        }

        // Add counts to postings
        for (const posting of postings) {
          posting.count = countMap.get(posting.id) || 0
        }
      }

      // Sort by count (most candidates first)
      postings.sort((a, b) => (b.count || 0) - (a.count || 0))

      return NextResponse.json({ success: true, postings })
    }

    // Fallback: No postings found, return empty with message
    return NextResponse.json({ 
      success: true, 
      postings: [],
      message: 'No job postings found. Create postings in Lever first.'
    })

  } catch (error) {
    return errorResponse(error, 'Lever postings error')
  }
}
