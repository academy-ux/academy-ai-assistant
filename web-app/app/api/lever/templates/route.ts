import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      console.error('LEVER_API_KEY not configured')
      return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
    }

    console.log('Fetching feedback templates from Lever...')

    // Lever API uses camelCase: feedbackTemplates (not feedback_templates)
    const response = await fetch(
      'https://api.lever.co/v1/feedbackTemplates',
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
      throw new Error(`Lever API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Lever feedback_templates raw response:', JSON.stringify(data).slice(0, 500))
    console.log('Total templates from Lever:', data.data?.length || 0)

    // Transform data for frontend, filtering out any with undefined name
    const templates = (data.data || [])
      .filter((template: any) => template.text) // Only include templates with a name
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

    console.log('Processed templates count:', templates.length)
    if (templates.length > 0) {
      console.log('First template:', templates[0].name)
    }

    return NextResponse.json({ success: true, templates })

  } catch (error: any) {
    console.error('Lever templates error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load templates',
      message: error.message,
      templates: [] // Return empty array so frontend doesn't crash
    }, { status: 500 })
  }
}
