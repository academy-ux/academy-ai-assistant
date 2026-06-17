import { NextRequest, NextResponse } from 'next/server'
import { fetchPosting } from '@/lib/lever'
import { errorResponse } from '@/lib/validation'

// Lightweight single-posting lookup (text/team/location) for the report header.
export async function GET(request: NextRequest) {
  try {
    const postingId = request.nextUrl.searchParams.get('postingId')
    if (!postingId) return NextResponse.json({ posting: null })
    const posting = await fetchPosting(postingId)
    return NextResponse.json({ posting })
  } catch (error) {
    return errorResponse(error, 'Posting fetch error')
  }
}
