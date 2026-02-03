import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { errorResponse } from '@/lib/validation'

// Table structure for candidate_notes (assumed/to be created if doesn't exist):
// id (uuid, primary key)
// candidate_email (text, index)
// content (text)
// created_at (timestamp)
// updated_at (timestamp)
// created_by (text)

export async function GET(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const email = params.email === 'unknown' ? null : params.email

        if (!email) {
            return NextResponse.json({ notes: [] })
        }
        const { data, error } = await supabase
            .from('candidate_notes')
            .select('*')
            .eq('candidate_email', email)
            .order('created_at', { ascending: false })

        if (error) {
            // If table doesn't exist, we'll get an error. In a real app we'd handle this or ensure migrations.
            // For now, return empty array if error occurs (likely table missing).
            console.error('Error fetching notes:', error)
            return NextResponse.json({ notes: [] })
        }

        return NextResponse.json({ notes: data })
    } catch (error) {
        return errorResponse(error, 'Error fetching candidate notes')
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { email: string } }
) {
    try {
        const email = params.email
        const { content, author } = await request.json()

        if (!email || !content) {
            return NextResponse.json({ error: 'Email and content are required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('candidate_notes')
            .insert([
                {
                    candidate_email: email,
                    content,
                    created_by: author,
                    created_at: new Date().toISOString()
                }
            ])
            .select()

        if (error) throw error

        return NextResponse.json({ success: true, note: data[0] })
    } catch (error) {
        return errorResponse(error, 'Error saving candidate note')
    }
}
