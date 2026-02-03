import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { errorResponse } from '@/lib/validation'

export async function GET(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const email = params.email === 'unknown' ? null : params.email
        const name = request.nextUrl.searchParams.get('name')

        if (!email && !name) {
            return NextResponse.json({ error: 'Email or name is required' }, { status: 400 })
        }

        // Search for meetings associated with this candidate
        // We look for meetings where the candidate_name matches or the email is in the transcript/name

        let query = supabase
            .from('interviews')
            .select('id, candidate_name, summary, created_at, meeting_date')

        const conditions = []
        if (email) {
            conditions.push(`candidate_name.ilike.%${email}%`)
            conditions.push(`transcript.ilike.%${email}%`)
        }
        if (name) {
            conditions.push(`candidate_name.ilike.%${name}%`)
        }

        const { data, error } = await query
            .or(conditions.join(','))
            .order('meeting_date', { ascending: false })
            .limit(5)

        if (error) throw error

        return NextResponse.json({ meetings: data })
    } catch (error) {
        return errorResponse(error, 'Error fetching candidate meeting info')
    }
}
