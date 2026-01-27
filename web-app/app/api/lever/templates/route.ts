import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    const response = await fetch(
      'https://api.lever.co/v1/feedback_templates',
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
    const templates = data.data.map((template: any) => ({
      id: template.id,
      name: template.text || template.name || 'Unnamed Template',
      fields: template.fields || [],
    }))

    return NextResponse.json({ success: true, templates })

  } catch (error: any) {
    console.error('Lever templates error:', error)
    return NextResponse.json({
      error: 'Failed to load templates',
      message: error.message
    }, { status: 500 })
  }
}
