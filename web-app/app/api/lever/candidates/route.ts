import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=100&expand=contact',
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
    const candidates = data.data.map((opp: any) => ({
      id: opp.id,
      name: opp.contact?.name || 'Unknown',
      email: opp.contact?.emails?.[0] || '',
      position: opp.posting?.text || opp.name || 'No position',
      stage: opp.stage,
      createdAt: opp.createdAt,
    }))

    return NextResponse.json({ success: true, candidates })

  } catch (error: any) {
    console.error('Lever candidates error:', error)
    return NextResponse.json({
      error: 'Failed to load candidates',
      message: error.message
    }, { status: 500 })
  }
}
