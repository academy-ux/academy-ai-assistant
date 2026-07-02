import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { errorResponse } from '@/lib/validation'
import { isResourcingAdmin } from '@/lib/auth'
import { savePlannerState } from '@/lib/resourcing-db'

export const dynamic = 'force-dynamic'

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const plannerSchema = z.object({
  plans: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        client: z.string().min(1).max(120),
        hrs: z.number().min(0).max(16),
        start: dayKey,
        end: dayKey,
      }).refine((b) => b.end >= b.start, { message: 'end must be on or after start' })
    )
    .max(500),
  timeoff: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120),
        start: dayKey,
        end: dayKey.nullish(), // optional on recurring rules
        weekdays: z.array(z.number().int().min(0).max(4)).max(5).nullish(),
      }).refine(
        (o) => (o.weekdays?.length ? !o.end || o.end >= o.start : Boolean(o.end && o.end >= o.start)),
        { message: 'one-off time off needs end ≥ start; recurring needs weekdays' }
      )
    )
    .max(500),
  budgets: z.record(z.string().max(160), z.number().min(0).max(100000)),
  capOverrides: z.record(z.string().max(120), z.number().min(0).max(80)),
})

export async function PUT(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isResourcingAdmin(token.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = plannerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid planner state', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await savePlannerState(parsed.data, token.email)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Resourcing planner save error')
  }
}
