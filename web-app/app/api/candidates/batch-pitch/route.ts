import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'
import { generatePitch, fetchJobDescription } from '@/lib/pitch'

export async function POST(request: NextRequest) {
    try {
        const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
        if (!success && rateLimitResponse) return rateLimitResponse

        const body = await request.json()
        const { candidates, postingId } = body as {
            candidates: { email: string; name: string }[]
            postingId: string
        }

        if (!candidates?.length || !postingId) {
            return NextResponse.json({ pitches: {} })
        }

        // Check which candidates already have a pitch for THIS posting
        const emails = candidates.map(c => c.email).filter(Boolean)
        const { data: existing } = await supabase
            .from('candidate_pitches')
            .select('candidate_email, pitch')
            .in('candidate_email', emails)
            .eq('posting_id', postingId)

        const existingMap = new Map(
            (existing || [])
                .filter(p => p.pitch && p.pitch.trim().length > 0)
                .map(p => [p.candidate_email, p.pitch])
        )

        // Filter to only candidates that need a pitch for this role
        const needsPitch = candidates.filter(c => c.email && !existingMap.has(c.email))

        const pitches: Record<string, string | null> = {}

        // Return existing pitches
        for (const [email, pitch] of existingMap) {
            pitches[email] = pitch
        }

        if (!needsPitch.length) {
            return NextResponse.json({ pitches })
        }

        // Fetch job description once
        const jobDescription = await fetchJobDescription(postingId)

        // Generate pitches sequentially to avoid rate limits
        for (const candidate of needsPitch) {
            try {
                const pitch = await generatePitch({
                    email: candidate.email,
                    candidateName: candidate.name,
                    jobDescription,
                })

                if (pitch) {
                    pitches[candidate.email] = pitch
                    // Persist to role-specific pitches table
                    await supabase
                        .from('candidate_pitches')
                        .upsert({
                            candidate_email: candidate.email,
                            posting_id: postingId,
                            pitch,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'candidate_email,posting_id' })
                } else {
                    pitches[candidate.email] = null
                }
            } catch (e) {
                console.error(`[Batch Pitch] Failed for ${candidate.email}:`, e)
                pitches[candidate.email] = null
            }
        }

        return NextResponse.json({ pitches })
    } catch (error) {
        console.error('[Batch Pitch] Error:', error)
        return NextResponse.json({ error: 'Failed to generate pitches' }, { status: 500 })
    }
}
