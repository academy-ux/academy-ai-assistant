import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeExperience, type ExperienceCandidate } from '@/lib/experience'

export async function POST(request: NextRequest) {
    try {
        const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
        if (!success && rateLimitResponse) return rateLimitResponse

        if (!process.env.LEVER_API_KEY) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const body = await request.json()
        const { candidates: candidateList, postingId } = body as {
            candidates: ExperienceCandidate[]
            postingId: string | null
        }

        if (!candidateList?.length) {
            return NextResponse.json({ experience: {} })
        }

        const experience = await computeExperience(candidateList, postingId)
        return NextResponse.json({ experience })
    } catch (error) {
        console.error('[Batch Experience] Error:', error)
        return NextResponse.json({ error: 'Failed to analyze experience' }, { status: 500 })
    }
}
