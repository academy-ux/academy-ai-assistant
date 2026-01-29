import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const templateId = params.id
  const leverKey = process.env.LEVER_API_KEY

  if (!leverKey) {
    return NextResponse.json({ error: 'Lever API not configured' }, { status: 500 })
  }

  const leverHeaders = {
    'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  }

  try {
    const response = await fetch(
      `https://api.lever.co/v1/feedback_templates/${encodeURIComponent(templateId)}`,
      { headers: leverHeaders }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error, status: response.status }, { status: response.status })
    }

    const data = await response.json()
    const templateData = data?.data || data
    
    return NextResponse.json({
      id: templateId,
      name: templateData?.text || templateData?.name,
      fields: (templateData?.fields || []).map((f: any) => ({
        id: f.id,
        text: f.text,
        type: f.type,
        required: f.required,
        description: f.description,
        options: f.options,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
