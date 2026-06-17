import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { validateBody, errorResponse } from '@/lib/validation'

const createShareSchema = z.object({
  postingId: z.string().min(1).max(100),
  postingTitle: z.string().max(200).optional(),
  // Optional access restrictions. Empty/omitted => public link.
  allowedEmails: z.array(z.string().email().max(200)).max(100).optional(),
  allowedDomains: z.array(z.string().max(200)).max(100).optional(),
})

function normalizeList(list: string[] | undefined): string[] {
  return Array.from(new Set((list || []).map(s => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)))
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: validationError } = await validateBody(request, createShareSchema)
    if (validationError) return validationError

    const allowedEmails = normalizeList(body.allowedEmails)
    const allowedDomains = normalizeList(body.allowedDomains)
    const restricted = allowedEmails.length > 0 || allowedDomains.length > 0

    // Check if an active share already exists for this posting
    const { data: existing } = await supabase
      .from('shared_reports' as any)
      .select('token')
      .eq('posting_id', body.postingId)
      .eq('is_active', true)
      .limit(1)
      .single()

    const origin = request.nextUrl.origin

    if (existing) {
      // Keep the same link, but update its access rules to whatever the user
      // just chose (this is how restrictions get added/changed/cleared).
      await supabase
        .from('shared_reports' as any)
        .update({ allowed_emails: allowedEmails, allowed_domains: allowedDomains })
        .eq('token', (existing as any).token)

      return NextResponse.json({
        success: true,
        token: (existing as any).token,
        url: `${origin}/share/${(existing as any).token}`,
        isNew: false,
        restricted,
      })
    }

    // Create a new share
    const { data: newShare, error: insertError } = await supabase
      .from('shared_reports' as any)
      .insert({
        posting_id: body.postingId,
        posting_title: body.postingTitle || null,
        created_by: token.email,
        allowed_emails: allowedEmails,
        allowed_domains: allowedDomains,
      })
      .select('token')
      .single()

    if (insertError || !newShare) {
      throw new Error(insertError?.message || 'Failed to create share link')
    }

    return NextResponse.json({
      success: true,
      token: (newShare as any).token,
      url: `${origin}/share/${(newShare as any).token}`,
      isNew: true,
      restricted,
    })
  } catch (error) {
    return errorResponse(error, 'Share creation error')
  }
}
