import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
export const dynamic = 'force-dynamic'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { uuidSchema, errorResponse } from '@/lib/validation'

// Allowed meeting types for non-admins
const ALLOWED_TYPES = ['Status Update', 'Client Call', 'Interview']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    const parseResult = uuidSchema.safeParse(params.id)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid interview ID format' }, { status: 400 })
    }

    const { data: interview, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
      }
      throw error
    }

    // Security check: non-admins cannot access restricted meeting types (unless they're the owner)
    const session = await getServerSession(authOptions)
    const isUserAdmin = isAdmin(session?.user?.email)
    const userEmail = session?.user?.email
    const isOwner = userEmail && interview.owner_email === userEmail

    if (!isUserAdmin && !isOwner && interview.meeting_type && !ALLOWED_TYPES.includes(interview.meeting_type)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(interview)
  } catch (error) {
    return errorResponse(error, 'Error fetching interview')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    const parseResult = uuidSchema.safeParse(params.id)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid interview ID format' }, { status: 400 })
    }

    const { error } = await supabase
      .from('interviews')
      .delete()
      .eq('id', params.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Error deleting interview')
  }
}
