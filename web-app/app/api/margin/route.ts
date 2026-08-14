import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { errorResponse } from '@/lib/validation'
import { isAdmin } from '@/lib/auth'
import { loadDeals, loadSettings } from '@/lib/margin-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(token.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [deals, settings] = await Promise.all([loadDeals(), loadSettings()])
    return NextResponse.json({ deals, settings })
  } catch (error) {
    return errorResponse(error, 'Margin load error')
  }
}
