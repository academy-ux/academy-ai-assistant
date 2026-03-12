import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { validateBody, errorResponse } from '@/lib/validation'

const createShareSchema = z.object({
  postingId: z.string().min(1).max(100),
  postingTitle: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: validationError } = await validateBody(request, createShareSchema)
    if (validationError) return validationError

    // Check if an active share already exists for this posting
    const { data: existing } = await supabase
      .from('shared_reports' as any)
      .select('token')
      .eq('posting_id', body.postingId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (existing) {
      const origin = request.nextUrl.origin
      return NextResponse.json({
        success: true,
        token: (existing as any).token,
        url: `${origin}/share/${(existing as any).token}`,
        isNew: false,
      })
    }

    // Create a new share
    const { data: newShare, error: insertError } = await supabase
      .from('shared_reports' as any)
      .insert({
        posting_id: body.postingId,
        posting_title: body.postingTitle || null,
        created_by: token.email,
      })
      .select('token')
      .single()

    if (insertError || !newShare) {
      throw new Error(insertError?.message || 'Failed to create share link')
    }

    const origin = request.nextUrl.origin
    return NextResponse.json({
      success: true,
      token: (newShare as any).token,
      url: `${origin}/share/${(newShare as any).token}`,
      isNew: true,
    })
  } catch (error) {
    return errorResponse(error, 'Share creation error')
  }
}
