// Pure calculation engine for the profitability tool. Every number shown on
// /margin comes from these functions — no math in components — so the
// spreadsheet logic lives in exactly one place.

// What the client engaged Academy for: a contract staffing role vs. hiring
// for a full-time role.
export type EngagementType = 'staffing' | 'recruiting'
// Where the talent is. Domestic talent must be W-2 (employment burden applies:
// FICA, insurance, compliance); international talent is paid as a contractor.
export type WorkerLocation = 'domestic' | 'international'
export type DealStage = 'estimate' | 'placed' | 'completed'

export interface RecruiterRate {
  label: string // e.g. "Senior"
  rate: number // $/hr
}

// A realistic search staffing combo, broken into members with hour
// quantities. Weekly cost is always derived from the members, never typed.
export interface SearchTeamMember {
  role: string // e.g. "Mid recruiter"
  rate: number // $/hr
  hoursPerWeek: number
}

export interface SearchTeam {
  label: string
  members: SearchTeamMember[]
}

export function teamWeeklyCost(team: SearchTeam): number {
  return team.members.reduce((sum, m) => sum + (m.rate || 0) * (m.hoursPerWeek || 0), 0)
}

export function teamComposition(team: SearchTeam): string {
  return team.members
    .map((m) => `${m.role} ${m.hoursPerWeek} hrs/wk @ $${m.rate}/hr`)
    .join(' + ')
}

export interface RateCardRow {
  level: string // e.g. "Senior"
  band: 'Low-end' | 'High-end'
  costRate: number
  billRate: number
}

export interface MarginSettings {
  minimumMarginPct: number // e.g. 0.2
  healthyMarginPct: number // e.g. 0.3
  // Employer burden applied on top of cost rate for domestic (W-2) talent
  // (FICA, unemployment insurance, JustWorks, compliance).
  employeeBurdenPct: number // e.g. 0.1
  // Recruiting engagements: default placement fee as a fraction of first-year salary
  placementFeePct: number // e.g. 0.2
  recruiterRates: RecruiterRate[]
  searchTeams: SearchTeam[]
  typicalSearchWeeks: number // how long a normal search runs; colors the budget grid
  rateCard: RateCardRow[]
}

export const DEFAULT_SETTINGS: MarginSettings = {
  minimumMarginPct: 0.2,
  healthyMarginPct: 0.3,
  employeeBurdenPct: 0.1,
  placementFeePct: 0.2,
  recruiterRates: [
    { label: 'Senior', rate: 100 },
    { label: 'Mid', rate: 75 },
    { label: 'Associate', rate: 50 },
    { label: 'Sourcing', rate: 12 },
  ],
  searchTeams: [
    {
      label: 'Mid + Sourcer',
      members: [
        { role: 'Mid recruiter', rate: 75, hoursPerWeek: 20 },
        { role: 'Sourcer', rate: 12, hoursPerWeek: 40 },
      ],
    },
    {
      label: 'Senior + Sourcer',
      members: [
        { role: 'Senior recruiter', rate: 100, hoursPerWeek: 20 },
        { role: 'Sourcer', rate: 12, hoursPerWeek: 40 },
      ],
    },
  ],
  typicalSearchWeeks: 4,
  rateCard: [
    { level: 'Mid-Level', band: 'Low-end', costRate: 60, billRate: 150 },
    { level: 'Mid-Level', band: 'High-end', costRate: 80, billRate: 150 },
    { level: 'Senior', band: 'Low-end', costRate: 80, billRate: 185 },
    { level: 'Senior', band: 'High-end', costRate: 110, billRate: 185 },
    { level: 'Leadership', band: 'Low-end', costRate: 110, billRate: 225 },
    { level: 'Leadership', band: 'High-end', costRate: 125, billRate: 225 },
  ],
}

// One set of deal numbers at one point in its life. Staffing engagements use
// the hourly fields (estimates derive hours from weeks × hours/week; actuals
// usually set totalHoursOverride from timesheets). Recruiting engagements use
// salary × feePct instead — the hire lands on the client's payroll and the
// placement fee is the revenue.
export interface StageSnapshot {
  billRate: number
  costRate: number
  weeks: number
  hoursPerWeek: number
  totalHoursOverride: number | null
  burdenPct: number // 0 for international (contractor) talent
  salary: number // recruiting: first-year base salary
  feePct: number // recruiting: placement fee fraction of salary
  recruiterSpend: number // $ spent sourcing this placement
  updatedAt?: string
}

export interface MarginDeal {
  id: string
  projectCode: string
  roleTitle: string
  client: string
  contractor: string
  engagementType: EngagementType
  workerLocation: WorkerLocation
  stage: DealStage
  estimate: StageSnapshot | null
  placed: StageSnapshot | null
  actual: StageSnapshot | null
  notes: string
  createdAt?: string
  updatedAt?: string
}

export interface DealResult {
  totalHours: number
  effectiveCostRate: number // costRate × (1 + burdenPct)
  revenue: number
  laborCost: number
  totalCost: number // labor + recruiter spend + internal cost
  margin: number // revenue − totalCost
  marginPct: number // margin / revenue (0 when revenue is 0)
  laborMargin: number // revenue − laborCost; what the sheet calls "Total Profit Margin"
  laborMarginPct: number
}

// Editing-time snapshot where numeric fields may be blank (null). Saved
// snapshots are always complete numbers; drafts coerce through
// coerceSnapshot once isSnapshotComplete passes.
export type NullableSnapshot = Omit<
  StageSnapshot,
  'billRate' | 'costRate' | 'weeks' | 'hoursPerWeek' | 'burdenPct' | 'salary' | 'feePct' | 'recruiterSpend'
> & {
  billRate: number | null
  costRate: number | null
  weeks: number | null
  hoursPerWeek: number | null
  burdenPct: number | null
  salary: number | null
  feePct: number | null
  recruiterSpend: number | null
}

export function emptyDraft(overrides: Partial<NullableSnapshot> = {}): NullableSnapshot {
  return {
    billRate: null,
    costRate: null,
    weeks: null,
    hoursPerWeek: null,
    totalHoursOverride: null,
    burdenPct: 0,
    salary: null,
    feePct: null,
    recruiterSpend: null,
    ...overrides,
  }
}

// The minimum inputs that make the math meaningful. Staffing: both rates plus
// either explicit total hours or a weeks × hours/week pair. Recruiting: a
// salary and a fee percentage.
export function isSnapshotComplete(s: NullableSnapshot, engagement: EngagementType = 'staffing'): boolean {
  if (engagement === 'recruiting') return s.salary !== null && s.feePct !== null
  return (
    s.billRate !== null &&
    s.costRate !== null &&
    (s.totalHoursOverride !== null || (s.weeks !== null && s.hoursPerWeek !== null))
  )
}

// Nothing entered at all (burden alone doesn't count — it's set by the
// talent-location toggle, not typed by the user).
export function isSnapshotBlank(s: NullableSnapshot): boolean {
  return (
    s.billRate === null &&
    s.costRate === null &&
    s.weeks === null &&
    s.hoursPerWeek === null &&
    s.totalHoursOverride === null &&
    s.salary === null &&
    s.feePct === null &&
    s.recruiterSpend === null
  )
}

export function coerceSnapshot(s: NullableSnapshot): StageSnapshot {
  return {
    billRate: s.billRate ?? 0,
    costRate: s.costRate ?? 0,
    weeks: s.weeks ?? 0,
    hoursPerWeek: s.hoursPerWeek ?? 0,
    totalHoursOverride: s.totalHoursOverride,
    burdenPct: s.burdenPct ?? 0,
    salary: s.salary ?? 0,
    feePct: s.feePct ?? 0,
    recruiterSpend: s.recruiterSpend ?? 0,
    updatedAt: s.updatedAt,
  }
}

export function computeDeal(s: StageSnapshot, engagement: EngagementType = 'staffing'): DealResult {
  if (engagement === 'recruiting') {
    // Direct hire: the client pays the salary; Academy's revenue is the
    // placement fee and the search itself is the only cost.
    const revenue = (s.salary || 0) * (s.feePct || 0)
    const totalCost = s.recruiterSpend || 0
    const margin = revenue - totalCost
    return {
      totalHours: 0,
      effectiveCostRate: 0,
      revenue,
      laborCost: 0,
      totalCost,
      margin,
      marginPct: revenue > 0 ? margin / revenue : 0,
      laborMargin: revenue,
      laborMarginPct: revenue > 0 ? 1 : 0,
    }
  }
  const totalHours = s.totalHoursOverride ?? s.weeks * s.hoursPerWeek
  const effectiveCostRate = s.costRate * (1 + (s.burdenPct || 0))
  const revenue = s.billRate * totalHours
  const laborCost = effectiveCostRate * totalHours
  const totalCost = laborCost + (s.recruiterSpend || 0)
  const margin = revenue - totalCost
  const laborMargin = revenue - laborCost
  return {
    totalHours,
    effectiveCostRate,
    revenue,
    laborCost,
    totalCost,
    margin,
    marginPct: revenue > 0 ? margin / revenue : 0,
    laborMargin,
    laborMarginPct: revenue > 0 ? laborMargin / revenue : 0,
  }
}

export type MarginHealth = 'loss' | 'thin' | 'acceptable' | 'healthy'

export function marginHealth(marginPct: number, settings: MarginSettings): MarginHealth {
  if (marginPct < 0) return 'loss'
  if (marginPct < settings.minimumMarginPct) return 'thin'
  if (marginPct < settings.healthyMarginPct) return 'acceptable'
  return 'healthy'
}

export interface RecruitingBudgetRow {
  label: string
  thresholdPct: number
  marginAvailable: number // labor margin left after protecting thresholdPct of revenue
  weeksByTeam: { label: string; weeklyCost: number; weeks: number }[]
}

// Sheet 1's core question, restated the way searches are actually staffed:
// if we insist on keeping X% gross margin, how many weeks can each search
// team keep looking before the spend eats through the floor?
export function recruitingBudget(result: DealResult, settings: MarginSettings): RecruitingBudgetRow[] {
  const thresholds = [
    { label: 'Break-even', thresholdPct: 0 },
    { label: `Minimum (${Math.round(settings.minimumMarginPct * 100)}%)`, thresholdPct: settings.minimumMarginPct },
    { label: `Healthy (${Math.round(settings.healthyMarginPct * 100)}%)`, thresholdPct: settings.healthyMarginPct },
  ]
  return thresholds.map(({ label, thresholdPct }) => {
    const marginAvailable = result.laborMargin - result.revenue * thresholdPct
    return {
      label,
      thresholdPct,
      marginAvailable,
      weeksByTeam: settings.searchTeams.map((t) => {
        const weeklyCost = teamWeeklyCost(t)
        return {
          label: t.label,
          weeklyCost,
          weeks: weeklyCost > 0 ? marginAvailable / weeklyCost : 0,
        }
      }),
    }
  })
}

export interface SensitivityCell {
  weeks: number
  totalHours: number
  margin: number
  marginPct: number
  health: MarginHealth
}

export interface SensitivityRow {
  costRate: number
  isCurrent: boolean
  cells: SensitivityCell[]
}

// Cost rate × engagement length grid (sheet 2's margin table). Rows bracket
// the current cost rate so the negotiating room is visible either direction.
export function sensitivityGrid(
  s: StageSnapshot,
  settings: MarginSettings,
  opts: { rateStep?: number; rateSpan?: number; weeksList?: number[] } = {}
): SensitivityRow[] {
  const { rateStep = 5, rateSpan = 3, weeksList = [4, 8, 12, 16, 20, 24, 32, 40] } = opts
  const base = Math.round(s.costRate / rateStep) * rateStep
  const rates: number[] = []
  for (let i = -rateSpan; i <= rateSpan; i++) {
    const r = base + i * rateStep
    if (r > 0) rates.push(r)
  }
  if (!rates.includes(s.costRate)) {
    rates.push(s.costRate)
    rates.sort((a, b) => a - b)
  }
  return rates.map((costRate) => ({
    costRate,
    isCurrent: costRate === s.costRate,
    cells: weeksList.map((weeks) => {
      const res = computeDeal({ ...s, costRate, weeks, totalHoursOverride: null })
      return {
        weeks,
        totalHours: res.totalHours,
        margin: res.margin,
        marginPct: res.marginPct,
        health: marginHealth(res.marginPct, settings),
      }
    }),
  }))
}

// ---------------------------------------------------------------------------
// Portfolio rollup
// ---------------------------------------------------------------------------

// A deal's "current truth" is its most advanced stage that has numbers:
// completed deals report actuals, placed deals report the placed terms, and
// everything else reports the estimate. Falls back to earlier stages so a
// deal advanced without data entry never vanishes from the rollup.
export function currentSnapshot(deal: MarginDeal): { snapshot: StageSnapshot; stage: DealStage } | null {
  const order: { stage: DealStage; snap: StageSnapshot | null }[] =
    deal.stage === 'completed'
      ? [
          { stage: 'completed', snap: deal.actual },
          { stage: 'placed', snap: deal.placed },
          { stage: 'estimate', snap: deal.estimate },
        ]
      : deal.stage === 'placed'
        ? [
            { stage: 'placed', snap: deal.placed },
            { stage: 'estimate', snap: deal.estimate },
          ]
        : [{ stage: 'estimate', snap: deal.estimate }]
  for (const { stage, snap } of order) {
    if (snap) return { snapshot: snap, stage }
  }
  return null
}

// Margin drift in percentage points vs. the original estimate. Negative =
// the deal eroded. Null until the deal has moved past its estimate.
export function marginDrift(deal: MarginDeal): number | null {
  if (!deal.estimate) return null
  const current = currentSnapshot(deal)
  if (!current || current.stage === 'estimate') return null
  const est = computeDeal(deal.estimate, deal.engagementType)
  const cur = computeDeal(current.snapshot, deal.engagementType)
  if (est.revenue <= 0) return null
  return (cur.marginPct - est.marginPct) * 100
}

export interface PortfolioTotals {
  count: number
  revenue: number
  totalCost: number
  margin: number
  blendedMarginPct: number
  belowMinimumCount: number
  totalHours: number
}

export function portfolioTotals(deals: MarginDeal[], settings: MarginSettings): PortfolioTotals {
  let revenue = 0
  let totalCost = 0
  let totalHours = 0
  let belowMinimumCount = 0
  let count = 0
  for (const deal of deals) {
    const current = currentSnapshot(deal)
    if (!current) continue
    const res = computeDeal(current.snapshot, deal.engagementType)
    if (res.revenue <= 0) continue
    count++
    revenue += res.revenue
    totalCost += res.totalCost
    totalHours += res.totalHours
    if (res.marginPct < settings.minimumMarginPct) belowMinimumCount++
  }
  const margin = revenue - totalCost
  return {
    count,
    revenue,
    totalCost,
    margin,
    blendedMarginPct: revenue > 0 ? margin / revenue : 0,
    belowMinimumCount,
    totalHours,
  }
}
