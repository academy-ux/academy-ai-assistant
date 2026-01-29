import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { uuidSchema, errorResponse } from '@/lib/validation'

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
