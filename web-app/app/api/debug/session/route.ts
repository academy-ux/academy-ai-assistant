import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const token = await getToken({ req: req as any })
  return NextResponse.json({
    session: session ?? null,
    token: token
      ? {
          name: (token as any).name,
          email: (token as any).email,
          picture: (token as any).picture ?? (token as any).image,
        }
      : null,
  })
}

