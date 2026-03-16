import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/candidates/[email]/pitch?postingId=xxx
 * Returns the role-specific pitch for this candidate + posting.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    const email = params.email === 'unknown' ? null : decodeURIComponent(params.email)
    const postingId = request.nextUrl.searchParams.get('postingId')

    if (!email || !postingId) {
        return NextResponse.json({ pitch: null })
    }

    const { data, error } = await supabase
        .from('candidate_pitches')
        .select('pitch')
        .eq('candidate_email', email)
        .eq('posting_id', postingId)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('[Pitch] Supabase read error:', error)
    }

    if (data?.pitch) {
        return NextResponse.json({ pitch: data.pitch })
    }

    // Fallback: check legacy pitch on candidate_profiles (pre-migration data)
    const { data: profile } = await supabase
        .from('candidate_profiles')
        .select('pitch')
        .eq('candidate_email', email)
        .single()

    return NextResponse.json({ pitch: profile?.pitch || null })
}

/**
 * POST /api/candidates/[email]/pitch
 * Body: { postingId, pitch }
 * Upserts a role-specific pitch for this candidate + posting.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    const email = params.email === 'unknown' ? null : decodeURIComponent(params.email)
    const body = await request.json()
    const { postingId, pitch } = body

    if (!email || !postingId) {
        return NextResponse.json({ error: 'Email and postingId are required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('candidate_pitches')
        .upsert({
            candidate_email: email,
            posting_id: postingId,
            pitch,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'candidate_email,posting_id' })

    if (error) {
        console.error('[Pitch] Supabase upsert error:', error)
        return NextResponse.json({ error: 'Failed to save pitch' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
