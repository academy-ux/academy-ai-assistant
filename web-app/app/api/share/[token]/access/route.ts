import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  resolveShare,
  isShareRestricted,
  emailMatchesShare,
  mintShareAccessCookie,
  shareAccessCookieName,
  requestHasShareAccess,
} from '@/lib/share'
import { validateBody, errorResponse } from '@/lib/validation'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * GET /api/share/[token]/access
 * Reports whether the share is restricted and whether the caller already has access.
 * Lets the page decide between showing the email gate or loading the report.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const share = await resolveShare(token)
    if (!share) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    const restricted = isShareRestricted(share)
    return NextResponse.json({
      restricted,
      hasAccess: restricted ? requestHasShareAccess(request, token, share) : true,
      postingTitle: share.postingTitle,
    })
  } catch (error) {
    return errorResponse(error, 'Share access check error')
  }
}

const accessSchema = z.object({
  email: z.string().email().max(200),
})

/**
 * POST /api/share/[token]/access
 * Body: { email }. If the email matches the share's allowlist, set a signed
 * access cookie. This is a SOFT gate — the email is not independently verified.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: body, error: validationError } = await validateBody(request, accessSchema)
    if (validationError) return validationError

    const share = await resolveShare(token)
    if (!share) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }

    // An unrestricted share grants access to any email.
    if (isShareRestricted(share) && !emailMatchesShare(body.email, share)) {
      return NextResponse.json(
        { error: "This email isn't authorized to view this report. Please use the email the link was sent to." },
        { status: 403 }
      )
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(shareAccessCookieName(token), mintShareAccessCookie(token, body.email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return response
  } catch (error) {
    return errorResponse(error, 'Share access error')
  }
}
