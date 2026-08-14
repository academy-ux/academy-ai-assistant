import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { errorResponse } from '@/lib/validation'
import { isAdmin } from '@/lib/auth'
import { deleteDeal, saveDeal } from '@/lib/margin-db'

export const dynamic = 'force-dynamic'

const snapshotSchema = z.object({
  billRate: z.number().min(0).max(10000),
  costRate: z.number().min(0).max(10000),
  weeks: z.number().min(0).max(500),
  hoursPerWeek: z.number().min(0).max(100),
  totalHoursOverride: z.number().min(0).max(100000).nullable(),
  burdenPct: z.number().min(0).max(2),
  salary: z.number().min(0).max(10000000),
  feePct: z.number().min(0).max(1),
  recruiterSpend: z.number().min(0).max(10000000),
  updatedAt: z.string().optional(),
})

const dealSchema = z.object({
  id: z.string().uuid(),
  projectCode: z.string().min(1).max(120),
  roleTitle: z.string().max(200).default(''),
  client: z.string().max(120).default(''),
  contractor: z.string().max(120).default(''),
  engagementType: z.enum(['staffing', 'recruiting']),
  workerLocation: z.enum(['domestic', 'international']),
  stage: z.enum(['estimate', 'placed', 'completed']),
  estimate: snapshotSchema.nullable(),
  placed: snapshotSchema.nullable(),
  actual: snapshotSchema.nullable(),
  notes: z.string().max(5000).default(''),
})

async function requireAdmin(req: NextRequest) {
  const token = await getToken({ req })
  if (!token?.email) {
    return { email: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isAdmin(token.email)) {
    return { email: null, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { email: token.email as string, res: null }
}

export async function PUT(req: NextRequest) {
  try {
    const { email, res } = await requireAdmin(req)
    if (res) return res

    const body = await req.json()
    const parsed = dealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await saveDeal(parsed.data, email!)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Margin deal save error')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { res } = await requireAdmin(req)
    if (res) return res

    const id = req.nextUrl.searchParams.get('id')
    const parsed = z.string().uuid().safeParse(id)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid deal id' }, { status: 400 })
    }

    await deleteDeal(parsed.data)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Margin deal delete error')
  }
}
