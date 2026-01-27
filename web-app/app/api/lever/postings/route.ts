import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    // Fetch all postings (not just published) - includes internal, closed, etc.
    const response = await fetch(
      'https://api.lever.co/v1/postings',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Lever API error:', response.status, errorText)
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Lever postings raw count:', data.data?.length || 0)

    // Transform data for frontend
    const postings = (data.data || []).map((posting: any) => ({
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
