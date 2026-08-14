import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { errorResponse } from '@/lib/validation'
import { isAdmin } from '@/lib/auth'
import { saveSettings } from '@/lib/margin-db'

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  minimumMarginPct: z.number().min(0).max(1),
  healthyMarginPct: z.number().min(0).max(1),
  employeeBurdenPct: z.number().min(0).max(1),
  placementFeePct: z.number().min(0).max(1),
  recruiterRates: z
    .array(z.object({ label: z.string().min(1).max(60), rate: z.number().min(0).max(10000) }))
    .min(1)
    .max(10),
  searchTeams: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        members: z
          .array(
            z.object({
              role: z.string().min(1).max(60),
              rate: z.number().min(0).max(10000),
              hoursPerWeek: z.number().min(0).max(100),
            })
          )
          .min(1)
          .max(6),
      })
    )
    .min(1)
    .max(10),
  typicalSearchWeeks: z.number().min(1).max(52),
  rateCard: z
    .array(
      z.object({
        level: z.string().min(1).max(60),
        band: z.enum(['Low-end', 'High-end']),
        costRate: z.number().min(0).max(10000),
        billRate: z.number().min(0).max(10000),
      })
    )
    .max(20),
})

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(token.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = settingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await saveSettings(parsed.data, token.email)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Margin settings save error')
  }
}
