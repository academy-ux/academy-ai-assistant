import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { paginationSchema, validateSearchParams, errorResponse } from '@/lib/validation'

// GET: List recent interviews
export async function GET(request: NextRequest) {
  try {
    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      paginationSchema
    )
    
    if (validationError) return validationError
    
    const { limit, offset } = params

    const { data, error, count } = await supabase
      .from('interviews')
      .select('*', { count: 'exact' })
      .order('meeting_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      interviews: data,
      count,
      limit,
      offset
    })
  } catch (error) {
    return errorResponse(error, 'Error fetching interviews')
  }
}
