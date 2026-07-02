// Harvest v2 API client + aggregation for the Resourcing Planner.
// Requires HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN (personal access token
// from id.getharvest.com → Developers).

const HARVEST_BASE = 'https://api.harvestapp.com/v2'

export interface HarvestBundle {
  people: Record<string, { cap: number; role: string; days: Record<string, Record<string, number>> }>
  clients: string[]
  burned: Record<string, number> // lifetime hours per project label
  starts: Record<string, string> // earliest known day per project label
  lastActual: string // most recent spent_date seen
  syncedAt: string
}

export function harvestConfigured(): boolean {
  return Boolean(process.env.HARVEST_ACCOUNT_ID && process.env.HARVEST_ACCESS_TOKEN)
}

async function harvestGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(HARVEST_BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
      'Harvest-Account-Id': process.env.HARVEST_ACCOUNT_ID!,
      'User-Agent': 'Academy AI Assistant (resourcing planner)',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Harvest ${path} failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

async function harvestGetAll<T>(
  path: string,
  params: Record<string, string>,
  key: string
): Promise<T[]> {
  const out: T[] = []
  let page = 1
  // Harvest caps per_page at 2000; total_pages guards the loop.
  for (;;) {
    const data = await harvestGet<any>(path, { ...params, per_page: '2000', page: String(page) })
    out.push(...(data[key] || []))
    if (!data.next_page) break
    page = data.next_page
  }
  return out
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// billable time = client delivery/consulting; non-billable = recruiting/sourcing
// (matches how Academy tracks work in Harvest — see resourcing handoff §8.2)
const kindOf = (billable: boolean) => (billable ? 'delivery' : 'recruiting')

export async function fetchHarvestBundle(windowDays = 120): Promise<HarvestBundle> {
  const today = new Date()
  const from = new Date(today.getTime() - windowDays * 86400000)

  const [users, entries, projectReport, projects] = await Promise.all([
    harvestGetAll<any>('/users', { is_active: 'true' }, 'users'),
    harvestGetAll<any>('/time_entries', { from: ymd(from), to: ymd(today) }, 'time_entries'),
    harvestGetAll<any>('/reports/time/projects', { from: '2015-01-01', to: ymd(today) }, 'results'),
    harvestGetAll<any>('/projects', {}, 'projects'),
  ])

  const people: HarvestBundle['people'] = {}
  for (const u of users) {
    const name = `${u.first_name} ${u.last_name}`.trim()
    people[name] = {
      cap: Math.round(((u.weekly_capacity || 0) / 3600) * 2) / 2,
      role: Array.isArray(u.roles) && u.roles.length ? u.roles[0] : '',
      days: {},
    }
  }

  const clients = new Set<string>()
  const starts: Record<string, string> = {}
  let lastActual = ''

  for (const e of entries) {
    const person = e.user?.name
    const client = e.client?.name
    const day = e.spent_date
    if (!person || !client || !day) continue
    const hours = typeof e.rounded_hours === 'number' ? e.rounded_hours : e.hours
    if (!hours || hours <= 0) continue
    const label = `${client} · ${kindOf(Boolean(e.billable))}`
    clients.add(client)
    const p = people[person] || (people[person] = { cap: 40, role: '', days: {} })
    const d = p.days[day] || (p.days[day] = {})
    d[label] = Math.round(((d[label] || 0) + hours) * 100) / 100
    if (!starts[label] || day < starts[label]) starts[label] = day
    if (day > lastActual) lastActual = day
  }

  // Lifetime burned hours per label from the projects time report.
  // billable_hours → "<client> · delivery"; the remainder → "<client> · recruiting".
  const burned: Record<string, number> = {}
  for (const r of projectReport) {
    const client = r.client_name
    if (!client) continue
    const billable = r.billable_hours || 0
    const nonBillable = (r.total_hours || 0) - billable
    if (billable > 0) {
      const l = `${client} · delivery`
      burned[l] = Math.round(((burned[l] || 0) + billable) * 100) / 100
    }
    if (nonBillable > 0) {
      const l = `${client} · recruiting`
      burned[l] = Math.round(((burned[l] || 0) + nonBillable) * 100) / 100
    }
  }

  // Prefer the project's contractual start date over the first entry in-window.
  for (const pr of projects) {
    const client = pr.client?.name
    if (!client || !pr.starts_on) continue
    for (const kind of ['delivery', 'recruiting']) {
      const label = `${client} · ${kind}`
      if (burned[label] != null && (!starts[label] || pr.starts_on < starts[label])) {
        starts[label] = pr.starts_on
      }
    }
  }

  return {
    people,
    clients: [...clients].sort(),
    burned,
    starts,
    lastActual: lastActual || ymd(today),
    syncedAt: new Date().toISOString(),
  }
}
