import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'

// Always reflect the current Lever state — don't serve a build-time cached list.
export const dynamic = 'force-dynamic'

// Evergreen "catch-all" postings live in Lever as published roles but aren't
// actual openings (e.g. "General Application", "Talent Network", "Invites").
// Exclude them by title so the report only lists real, active roles.
function isEvergreenBucket(text: string): boolean {
  return /general application|talent network|\binvites?\b/i.test(text || '')
}

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    // Fetch only published (publicly live) job postings. Lever's `internal`
    // state also holds parked/evergreen buckets (general applications, Academy
    // internal hires), so it's excluded to keep this list to truly active roles.
    const headers = {
      'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    }

    const publishedRes = await fetch(
      'https://api.lever.co/v1/postings?state=published&limit=100',
      { headers }
    )

    const postings: any[] = []

    if (publishedRes.ok) {
      const data = await publishedRes.json()
      for (const posting of data.data || []) {
        if (isEvergreenBucket(posting.text)) continue
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
        { headers }
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
