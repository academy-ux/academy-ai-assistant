import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const response = await fetch(
      'https://api.lever.co/v1/postings?state=published',
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

    // Transform data for frontend
    const postings = data.data.map((posting: any) => ({
      id: posting.id,
      text: posting.text, // Job title
      team: posting.categories?.team || '',
      location: posting.categories?.location || '',
      state: posting.state,
    }))

    return NextResponse.json({ success: true, postings })

  } catch (error: any) {
    console.error('Lever postings error:', error)
    return NextResponse.json({
      error: 'Failed to load postings',
      message: error.message
    }, { status: 500 })
  }
}
