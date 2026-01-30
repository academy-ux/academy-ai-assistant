import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { paginationSchema, validateSearchParams, errorResponse } from '@/lib/validation'

// Allowed meeting types for non-admins when viewing others' meetings
const ALLOWED_TYPES = ['Status Update', 'Client Call', 'Interview']

// GET: List recent interviews
export async function GET(request: NextRequest) {
  try {
    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      paginationSchema
    )
    
    if (validationError) return validationError
    
    const { limit, offset } = params
    
    const session = await getServerSession(authOptions)
    const view = request.nextUrl.searchParams.get('view') || 'mine'
    const isUserAdmin = isAdmin(session?.user?.email)
    const userEmail = session?.user?.email

    console.log(`[Interviews API] view=${view}, isAdmin=${isUserAdmin}, email=${userEmail}`)

    let query = supabase
      .from('interviews')
      .select('*', { count: 'exact' })

    // Filter by owner if viewing 'mine' (default)
    if (view === 'mine' && userEmail) {
      console.log(`[Interviews API] Applying 'mine' filter`)
      // Show all of user's own meetings (no type restriction for your own meetings)
      // Include NULL owner_email for legacy records (before owner tracking was added)
      query = query.or(`owner_email.eq.${userEmail},owner_email.is.null`)
    } else if (view === 'all' && !isUserAdmin && userEmail) {
      console.log(`[Interviews API] Applying non-admin 'all' filter`)
      // Non-admins viewing "All History": show allowed types OR their own meetings
      query = query.or(`meeting_type.in.(${ALLOWED_TYPES.join(',')}),owner_email.eq.${userEmail},owner_email.is.null`)
    } else if (view === 'all' && isUserAdmin) {
      console.log(`[Interviews API] Admin viewing 'all' - NO FILTER`)
    }
    // Admins viewing 'all' get everything (no filter)

    const { data, error, count } = await query
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
