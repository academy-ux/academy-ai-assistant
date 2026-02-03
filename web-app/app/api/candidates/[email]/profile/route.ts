import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { errorResponse } from '@/lib/validation'

export async function GET(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const email = params.email === 'unknown' ? null : params.email

        if (!email) {
            return NextResponse.json({ profile: null })
        }

        const { data, error } = await supabase
            .from('candidate_profiles')
            .select('*')
            .eq('candidate_email', email)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('Supabase error fetching profile:', error)
        }

        return NextResponse.json({ profile: data || null })
    } catch (error) {
        return errorResponse(error, 'Error fetching candidate profile')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const email = params.email === 'unknown' ? null : params.email
        const body = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('candidate_profiles')
            .upsert({
                candidate_email: email,
                ...body,
                updated_at: new Date().toISOString()
            }, { onConflict: 'candidate_email' })
            .select()

        if (error) throw error

        return NextResponse.json({ success: true, data: data[0] })
    } catch (error) {
        return errorResponse(error, 'Error saving candidate profile')
    }
}
