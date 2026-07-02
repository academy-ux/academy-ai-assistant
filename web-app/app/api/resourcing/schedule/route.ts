import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { errorResponse } from '@/lib/validation'
import { isResourcingAdmin } from '@/lib/auth'
import { fetchHarvestBundle, harvestConfigured, type HarvestBundle } from '@/lib/harvest'
import { loadPlannerState } from '@/lib/resourcing-db'

export const dynamic = 'force-dynamic'

// Harvest pulls are cached in-process; planner state is always read fresh.
const CACHE_TTL_MS = 10 * 60 * 1000
let cache: { bundle: HarvestBundle; ts: number } | null = null

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isResourcingAdmin(token.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!harvestConfigured()) {
      return NextResponse.json(
        {
          error: 'harvest_not_configured',
          message:
            'Set HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN (personal access token from id.getharvest.com → Developers).',
        },
        { status: 503 }
      )
    }

    const refresh = req.nextUrl.searchParams.get('refresh') === '1'
    if (!cache || refresh || Date.now() - cache.ts > CACHE_TTL_MS) {
      cache = { bundle: await fetchHarvestBundle(), ts: Date.now() }
    }

    const planner = await loadPlannerState()
    return NextResponse.json({ ...cache.bundle, planner })
  } catch (error) {
    return errorResponse(error, 'Resourcing schedule error')
  }
}
