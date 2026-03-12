import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'
import { fetchCandidatesForPosting } from '@/lib/lever'

const candidatesQuerySchema = z.object({
  postingId: z.string().max(100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      candidatesQuerySchema
    )
    if (validationError) return validationError

    const candidates = await fetchCandidatesForPosting(params.postingId)
    return NextResponse.json({ success: true, candidates })

  } catch (error) {
    return errorResponse(error, 'Lever candidates error')
  }
}
