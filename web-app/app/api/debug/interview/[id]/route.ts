import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id

  const { data, error } = await (supabase as any)
    .from('interviews')
    .select('id, meeting_title, candidate_id, candidate_name, submitted_at, updated_at, created_at')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    meeting_title: data.meeting_title,
    candidate_id: data.candidate_id,
    candidate_name: data.candidate_name,
    submitted_at: data.submitted_at,
    updated_at: data.updated_at,
    created_at: data.created_at,
    isSubmitted: Boolean(data.submitted_at || data.candidate_id),
  })
}
