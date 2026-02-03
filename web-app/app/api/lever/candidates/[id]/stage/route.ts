import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/validation'

const updateStageSchema = z.object({
    stageId: z.string().min(1)
})

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const leverKey = process.env.LEVER_API_KEY
        if (!leverKey) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const opportunityId = params.id
        const body = await request.json()
        const result = updateStageSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid stage data' }, { status: 400 })
        }

        const { stageId } = result.data

        const response = await fetch(`https://api.lever.co/v1/opportunities/${opportunityId}/stage`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stage: stageId })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Lever API error: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json({ success: true, data })

    } catch (error) {
        return errorResponse(error, 'Lever stage update error')
    }
}
