import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'

export async function GET() {
    try {
        const leverKey = process.env.LEVER_API_KEY

        if (!leverKey) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const response = await fetch('https://api.lever.co/v1/stages', {
            headers: {
                'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Lever API error: ${response.status}`)
        }

        const data = await response.json()

        // Sort stages by their order if available, or just return them
        const stages = data.data.map((s: any) => ({
            id: s.id,
            text: s.text
        }))

        return NextResponse.json({ success: true, stages })

    } catch (error) {
        return errorResponse(error, 'Lever stages error')
    }
}
