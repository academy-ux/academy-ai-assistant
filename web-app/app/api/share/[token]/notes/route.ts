import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { resolveShareCandidate, requestHasShareAccess } from '@/lib/share'
import { validateBody, errorResponse } from '@/lib/validation'

/**
 * GET /api/share/[token]/notes?candidateId=xxx
 * Returns ONLY client-submitted notes for the candidate. Internal recruiter
 * notes (source = 'internal') are never exposed on the public share.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const candidateId = request.nextUrl.searchParams.get('candidateId')
    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
    }

    const resolved = await resolveShareCandidate(token, candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const email = resolved.candidate.email
    if (!email) return NextResponse.json({ notes: [] })

    const { data, error } = await supabase
      .from('candidate_notes')
      .select('id, content, created_at, created_by')
      .eq('candidate_email', email)
      .eq('source', 'client')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Share notes] read error:', error)
      return NextResponse.json({ notes: [] })
    }

    return NextResponse.json({ notes: data || [] })
  } catch (error) {
    return errorResponse(error, 'Share notes read error')
  }
}

const createNoteSchema = z.object({
  candidateId: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  author: z.string().max(120).optional(),
})

/**
 * POST /api/share/[token]/notes
 * Body: { candidateId, content, author? }
 * Stores a client note against the candidate (source = 'client') so it shows up
 * both on the shared report and in the internal recruiter view.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: body, error: validationError } = await validateBody(request, createNoteSchema)
    if (validationError) return validationError

    const resolved = await resolveShareCandidate(token, body.candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const email = resolved.candidate.email
    if (!email) {
      return NextResponse.json({ error: 'This candidate cannot receive notes' }, { status: 400 })
    }

    const author = (body.author?.trim() || 'Client')

    const { data, error } = await supabase
      .from('candidate_notes')
      .insert([{
        candidate_email: email,
        content: body.content,
        created_by: author,
        source: 'client',
        created_at: new Date().toISOString(),
      }] as any)
      .select('id, content, created_at, created_by')

    if (error) throw error

    return NextResponse.json({ success: true, note: (data as any)?.[0] })
  } catch (error) {
    return errorResponse(error, 'Share notes write error')
  }
}

const editNoteSchema = z.object({
  candidateId: z.string().min(1).max(100),
  noteId: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
})

/**
 * PATCH /api/share/[token]/notes — edit a client note's text.
 * Scoped to source='client' and this candidate's email, so the public share can
 * never touch internal recruiter notes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: body, error: validationError } = await validateBody(request, editNoteSchema)
    if (validationError) return validationError

    const resolved = await resolveShareCandidate(token, body.candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }
    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const email = resolved.candidate.email
    if (!email) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('candidate_notes')
      .update({ content: body.content } as any)
      .eq('id', body.noteId)
      .eq('candidate_email', email)
      .eq('source', 'client')
      .select('id, content, created_at, created_by')

    if (error) throw error
    if (!data?.length) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    return NextResponse.json({ success: true, note: (data as any)[0] })
  } catch (error) {
    return errorResponse(error, 'Share notes edit error')
  }
}

const deleteNoteSchema = z.object({
  candidateId: z.string().min(1).max(100),
  noteId: z.string().min(1).max(100),
})

/**
 * DELETE /api/share/[token]/notes — remove a client note.
 * Same scoping guarantees as PATCH.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: body, error: validationError } = await validateBody(request, deleteNoteSchema)
    if (validationError) return validationError

    const resolved = await resolveShareCandidate(token, body.candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }
    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    const email = resolved.candidate.email
    if (!email) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const { error } = await supabase
      .from('candidate_notes')
      .delete()
      .eq('id', body.noteId)
      .eq('candidate_email', email)
      .eq('source', 'client')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Share notes delete error')
  }
}
