import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { errorResponse } from '@/lib/validation'

// Table structure for candidate_notes (assumed/to be created if doesn't exist):
// id (uuid, primary key)
// candidate_email (text, index)
// content (text)
// created_at (timestamp)
// updated_at (timestamp)
// created_by (text)

export async function GET(request: NextRequest, props: { params: Promise<{ email: string }> }) {
    const params = await props.params;
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

export async function POST(request: NextRequest, props: { params: Promise<{ email: string }> }) {
    const params = await props.params;
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

/**
 * PATCH /api/candidates/[email]/notes
 * Body: { noteId, content }. A signed-in staff member can edit a note if they
 * authored it; admins can edit any note on the candidate.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ email: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions)
        const userEmail = session?.user?.email
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const email = params.email
        const { noteId, content } = await request.json().catch(() => ({}))

        if (!email || !noteId || !content?.trim()) {
            return NextResponse.json({ error: 'Email, noteId and content are required' }, { status: 400 })
        }

        const { data: note, error: fetchError } = await supabase
            .from('candidate_notes')
            .select('id, created_by')
            .eq('id', noteId)
            .eq('candidate_email', email)
            .single()

        if (fetchError || !note) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        const author = (note as any).created_by
        const isAuthor = author === session?.user?.name || author === userEmail
        if (!isAuthor && !isAdmin(userEmail)) {
            return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('candidate_notes')
            .update({ content: content.trim() } as any)
            .eq('id', noteId)
            .eq('candidate_email', email)
            .select('id, content, created_at, created_by, source')

        if (error) throw error

        return NextResponse.json({ success: true, note: (data as any)?.[0] })
    } catch (error) {
        return errorResponse(error, 'Error editing candidate note')
    }
}

/**
 * DELETE /api/candidates/[email]/notes
 * Body: { noteId }. A signed-in staff member can delete a note if they authored
 * it; admins can delete any note on the candidate.
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ email: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions)
        const userEmail = session?.user?.email
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const email = params.email
        const { noteId } = await request.json().catch(() => ({}))

        if (!email || !noteId) {
            return NextResponse.json({ error: 'Email and noteId are required' }, { status: 400 })
        }

        // Look up the note so we can check authorship.
        const { data: note, error: fetchError } = await supabase
            .from('candidate_notes')
            .select('id, created_by')
            .eq('id', noteId)
            .eq('candidate_email', email)
            .single()

        if (fetchError || !note) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        // Author (matched by stored created_by) or admin may delete.
        const author = (note as any).created_by
        const isAuthor = author === session?.user?.name || author === userEmail
        if (!isAuthor && !isAdmin(userEmail)) {
            return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 })
        }

        const { error } = await supabase
            .from('candidate_notes')
            .delete()
            .eq('id', noteId)
            .eq('candidate_email', email)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        return errorResponse(error, 'Error deleting candidate note')
    }
}
