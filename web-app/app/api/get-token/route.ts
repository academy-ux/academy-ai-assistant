import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated or no access token' }, { status: 401 })
    }

    return NextResponse.json({
      accessToken: token.accessToken,
      email: token.email,
      expiresAt: token.exp
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
