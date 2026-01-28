import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      console.error('LEVER_API_KEY not configured')
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
      const errorText = await response.text()
      console.error('Lever API error:', response.status)
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform data for frontend, filtering out any with undefined name
    const templates = (data.data || [])
      .filter((template: any) => template.text)
      .map((template: any) => ({
        id: template.id,
        name: template.text || 'Unnamed Template',
        instructions: template.instructions || '',
        fields: (template.fields || []).map((field: any) => ({
          id: field.id,
          text: field.text || '',
          description: field.description || '',
          required: field.required || false,
          type: field.type || 'text',
          options: field.options || [],
        })),
      }))

    return NextResponse.json({ success: true, templates })

  } catch (error) {
    return errorResponse(error, 'Lever templates error')
  }
}
