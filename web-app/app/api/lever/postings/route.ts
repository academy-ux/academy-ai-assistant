import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'

// Always reflect the current Lever state — don't serve a build-time cached list.
export const dynamic = 'force-dynamic'

// Lever posting states we surface as selectable jobs. `published` is the set of
// publicly-live roles; `internal` is where evergreen "catch-all" postings live
// (General Application, Talent Network, Invites). We intentionally include the
// internal buckets so a general opportunity can be selected, and do NOT filter
// any of them out by title.
const SELECTABLE_STATES = ['published', 'internal']

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const headers = {
      'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    }

    // Lever's `state` param takes a single value, so fetch each state in
    // parallel and merge. Dedupe by id in case of any overlap.
    const responses = await Promise.all(
      SELECTABLE_STATES.map((state) =>
        fetch(`https://api.lever.co/v1/postings?state=${state}&limit=100`, { headers })
      )
    )

    const postings: any[] = []
    const seen = new Set<string>()

    for (const res of responses) {
      if (!res.ok) continue
      const data = await res.json()
      for (const posting of data.data || []) {
        if (seen.has(posting.id)) continue
        seen.add(posting.id)
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
