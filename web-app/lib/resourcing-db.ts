// Supabase persistence for planner state (bookings, time off, budgets, capacity
// overrides). Uses an untyped client because these tables are not yet in the
// generated Database types (run sync-supabase-types.sh to regenerate).
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface PlannerBooking {
  id: string
  name: string // person
  client: string
  hrs: number // hours per day
  start: string // inclusive YYYY-MM-DD
  end: string
}

export interface PlannerTimeoff {
  id: string
  name: string
  start: string
  end?: string | null // null/absent on recurring rules = no end date
  weekdays?: number[] | null // 0-4 (Mon..Fri); set = repeats weekly on those days
}

export interface PlannerState {
  plans: PlannerBooking[]
  timeoff: PlannerTimeoff[]
  budgets: Record<string, number> // label -> target hours
  capOverrides: Record<string, number> // person -> weekly hours
}

export async function loadPlannerState(): Promise<PlannerState> {
  const [plans, timeoff, budgets, caps] = await Promise.all([
    sb.from('resourcing_bookings').select('*').order('created_at'),
    sb.from('resourcing_timeoff').select('*').order('created_at'),
    sb.from('resourcing_budgets').select('*'),
    sb.from('resourcing_capacity_overrides').select('*'),
  ])
  for (const r of [plans, timeoff, budgets, caps]) {
    if (r.error) throw new Error(`Planner load failed: ${r.error.message}`)
  }
  return {
    plans: (plans.data || []).map((b: any) => ({
      id: b.id,
      name: b.person,
      client: b.client,
      hrs: Number(b.hours_per_day),
      start: b.start_day,
      end: b.end_day,
    })),
    timeoff: (timeoff.data || []).map((o: any) => ({
      id: o.id,
      name: o.person,
      start: o.start_day,
      end: o.end_day ?? null,
      weekdays: o.weekdays
        ? String(o.weekdays).split(',').map(Number).filter((n: number) => n >= 0 && n <= 4)
        : null,
    })),
    budgets: Object.fromEntries((budgets.data || []).map((b: any) => [b.label, Number(b.hours)])),
    capOverrides: Object.fromEntries(
      (caps.data || []).map((c: any) => [c.person, Number(c.weekly_hours)])
    ),
  }
}

// Replace-all save: the planner dataset is tiny (tens of rows), and funneling
// every mutation — create, edit, drag, undo, redo — through one full-state write
// keeps client undo/redo trivially correct. Upsert-then-prune (not delete-then-
// insert) so a failed step never leaves the table emptier than it started.
export async function savePlannerState(state: PlannerState, editor: string): Promise<void> {
  const now = new Date().toISOString()

  const replace = async (table: string, pk: string, rows: any[]) => {
    if (rows.length) {
      const { error } = await sb.from(table).upsert(rows)
      if (error) throw new Error(`Planner save failed (${table}): ${error.message}`)
    }
    const keep = new Set(rows.map((r) => r[pk]))
    const existing = await sb.from(table).select(pk)
    if (existing.error) throw new Error(`Planner save failed (${table}): ${existing.error.message}`)
    const stale = (existing.data || []).map((r: any) => r[pk]).filter((v: any) => !keep.has(v))
    if (stale.length) {
      const { error } = await sb.from(table).delete().in(pk, stale)
      if (error) throw new Error(`Planner save failed (${table}): ${error.message}`)
    }
  }

  await replace(
    'resourcing_bookings',
    'id',
    state.plans.map((b) => ({
      id: b.id,
      person: b.name,
      client: b.client,
      hours_per_day: b.hrs,
      start_day: b.start,
      end_day: b.end,
      created_by: editor,
      updated_at: now,
    }))
  )

  await replace(
    'resourcing_timeoff',
    'id',
    state.timeoff.map((o) => ({
      id: o.id,
      person: o.name,
      start_day: o.start,
      end_day: o.end || null,
      weekdays: o.weekdays?.length ? o.weekdays.join(',') : null,
      created_by: editor,
      updated_at: now,
    }))
  )

  await replace(
    'resourcing_budgets',
    'label',
    Object.entries(state.budgets).map(([label, hours]) => ({
      label,
      hours,
      updated_by: editor,
      updated_at: now,
    }))
  )

  await replace(
    'resourcing_capacity_overrides',
    'person',
    Object.entries(state.capOverrides).map(([person, weekly_hours]) => ({
      person,
      weekly_hours,
      updated_by: editor,
      updated_at: now,
    }))
  )
}
