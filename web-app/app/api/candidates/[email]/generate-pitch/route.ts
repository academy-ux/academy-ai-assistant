import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { generatePitch, fetchJobDescription } from '@/lib/pitch'

export async function POST(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
        if (!success && rateLimitResponse) return rateLimitResponse

        const body = await request.json()
        const { candidateName, postingId } = body

        const email = params.email === 'unknown' ? null : decodeURIComponent(params.email)

        if (!email && !candidateName) {
            return NextResponse.json({ error: 'Email or candidate name is required' }, { status: 400 })
        }

        const jobDescription = await fetchJobDescription(postingId)
        const pitch = await generatePitch({ email, candidateName, jobDescription })

        if (!pitch) {
            return NextResponse.json({
                error: 'No interview transcripts found for this candidate. Upload a meeting transcript first.',
            }, { status: 404 })
        }

        return NextResponse.json({ success: true, pitch })
    } catch (error) {
        console.error('[Generate Pitch] Error:', error)
        const message = error instanceof Error ? error.message : 'Failed to generate pitch'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
