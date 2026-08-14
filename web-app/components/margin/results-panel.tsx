'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency, formatPct } from '@/lib/utils'
import {
  computeDeal,
  marginHealth,
  recruitingBudget,
  teamComposition,
  teamWeeklyCost,
  type EngagementType,
  type MarginSettings,
  type SearchTeam,
  type StageSnapshot,
} from '@/lib/margin-calc'
import { HEALTH_META, HealthBadge } from '@/components/margin/health'

function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 min-w-0">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-xl font-semibold tracking-tight tabular-nums truncate', className)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

// Headline numbers + margin band. Accepts null (inputs incomplete): tiles and
// band stay in place with quiet dashes so results appear without any reflow.
export function ResultsPanel({
  snapshot,
  settings,
  engagement = 'staffing',
}: {
  snapshot: StageSnapshot | null
  settings: MarginSettings
  engagement?: EngagementType
}) {
  const recruiting = engagement === 'recruiting'
  const r = snapshot ? computeDeal(snapshot, engagement) : null
  const health = r ? marginHealth(r.marginPct, settings) : null
  const meta = health ? HEALTH_META[health] : null

  // Position of the needle on the 0 → 50% margin band
  const bandMax = 0.5
  const needle = r ? Math.max(0, Math.min(1, r.marginPct / bandMax)) : null
  const minPos = settings.minimumMarginPct / bandMax
  const healthyPos = settings.healthyMarginPct / bandMax

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label={recruiting ? 'Placement fee' : 'Revenue'}
          value={r ? formatCurrency(r.revenue) : '—'}
          sub={
            r && snapshot
              ? recruiting
                ? `${formatPct(snapshot.feePct, 0)} of ${formatCurrency(snapshot.salary)} salary`
                : `${r.totalHours.toLocaleString()} hrs × ${formatCurrency(snapshot.billRate)}/hr`
              : recruiting
                ? 'fee % × salary'
                : 'hours × billable rate'
          }
          className={r ? undefined : 'text-muted-foreground/40'}
        />
        <Stat
          label="Total cost"
          value={r ? formatCurrency(r.totalCost) : '—'}
          sub={
            r && snapshot
              ? recruiting
                ? 'recruiter spend'
                : snapshot.burdenPct > 0
                  ? `labor at ${formatCurrency(r.effectiveCostRate)}/hr burdened`
                  : `labor ${formatCurrency(r.laborCost)}`
              : recruiting
                ? 'recruiter spend'
                : 'labor + recruiting'
          }
          className={r ? undefined : 'text-muted-foreground/40'}
        />
        <Stat
          label="Margin"
          value={r ? formatCurrency(r.margin) : '—'}
          className={meta ? meta.text : 'text-muted-foreground/40'}
        />
        <Stat
          label="Gross margin"
          value={r ? formatPct(r.marginPct) : '—'}
          className={meta ? meta.text : 'text-muted-foreground/40'}
        />
      </div>

      {/* Margin band: where this deal sits vs. minimum / healthy thresholds */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Margin health</span>
          {health ? (
            <HealthBadge health={health} />
          ) : (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Awaiting inputs
            </span>
          )}
        </div>

        {/* Value chip riding the needle position (height reserved when empty) */}
        <div className="relative h-6 mb-1">
          {needle !== null && r && meta && (
            <span
              className={cn(
                'absolute -translate-x-1/2 rounded-md border px-1.5 py-0.5 text-2xs font-bold tabular-nums whitespace-nowrap transition-[left] duration-200',
                meta.badge
              )}
              style={{ left: `${Math.min(Math.max(needle * 100, 5), 95)}%` }}
            >
              {formatPct(r.marginPct)}
            </span>
          )}
        </div>

        <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-destructive/25" style={{ width: `${minPos * 100}%` }} />
          <div
            className="absolute inset-y-0 bg-warning/25"
            style={{ left: `${minPos * 100}%`, width: `${(healthyPos - minPos) * 100}%` }}
          />
          <div className="absolute inset-y-0 bg-success/25" style={{ left: `${healthyPos * 100}%`, right: 0 }} />
          {needle !== null && meta && (
            <div
              className={cn('absolute top-0 bottom-0 w-1.5 rounded-full transition-[left] duration-200', meta.bar)}
              style={{ left: `calc(${needle * 100}% - 3px)` }}
            />
          )}
        </div>
        <div className="relative mt-1.5 h-4 text-2xs text-muted-foreground">
          <span className="absolute" style={{ left: 0 }}>0%</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${minPos * 100}%` }}>
            {Math.round(settings.minimumMarginPct * 100)}% min
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${healthyPos * 100}%` }}>
            {Math.round(settings.healthyMarginPct * 100)}% healthy
          </span>
          <span className="absolute right-0">{Math.round(bandMax * 100)}%+</span>
        </div>

        {/* Distance to each threshold (height reserved when empty) */}
        <p className="text-xs text-muted-foreground mt-2 min-h-4 tabular-nums">
          {r && health && (
            health === 'loss' ? (
              <span className="text-destructive font-medium">
                Losing {formatCurrency(-r.margin)} — costs exceed billings on this deal.
              </span>
            ) : (
              <>
                {describeDistance(r.marginPct, settings.minimumMarginPct, 'minimum')}
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                {describeDistance(r.marginPct, settings.healthyMarginPct, 'healthy target')}
              </>
            )
          )}
        </p>
      </div>
    </div>
  )
}

function describeDistance(marginPct: number, threshold: number, label: string) {
  const pts = (marginPct - threshold) * 100
  const above = pts >= 0
  return (
    <span className={above ? undefined : 'text-warning font-medium'}>
      {Math.abs(pts).toFixed(1)} pts {above ? 'above' : 'below'} the {Math.round(threshold * 100)}%{' '}
      {label}
    </span>
  )
}

// "Can this deal afford a real search?" — for each search-team combo, how
// many weeks of searching each margin floor pays for, judged against how
// long a typical search runs. Editable in place when onSettingsSave is
// provided: tweak a team's weekly cost and watch the weeks respond live.
export function RecruitingBudget({
  snapshot,
  settings,
  engagement = 'staffing',
  onSettingsSave,
}: {
  snapshot: StageSnapshot
  settings: MarginSettings
  engagement?: EngagementType
  onSettingsSave?: (next: MarginSettings) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftTeams, setDraftTeams] = useState<SearchTeam[]>(settings.searchTeams)
  const [draftWeeks, setDraftWeeks] = useState(settings.typicalSearchWeeks)

  const r = computeDeal(snapshot, engagement)
  // While editing, weeks compute from the draft so tweaks respond live.
  const activeSettings = editing
    ? { ...settings, searchTeams: draftTeams, typicalSearchWeeks: draftWeeks || 1 }
    : settings
  const floors = recruitingBudget(r, activeSettings)
  const typical = activeSettings.typicalSearchWeeks
  const teams = activeSettings.searchTeams

  const startEditing = () => {
    setDraftTeams(structuredClone(settings.searchTeams))
    setDraftWeeks(settings.typicalSearchWeeks)
    setEditing(true)
  }

  const save = async () => {
    const cleaned = draftTeams
      .map((t) => ({
        label: t.label.trim(),
        members: t.members
          .map((m) => ({ ...m, role: m.role.trim() }))
          .filter((m) => m.role),
      }))
      .filter((t) => t.label && t.members.length)
    if (!cleaned.length) {
      toast.error('Keep at least one search team with at least one member')
      return
    }
    setSaving(true)
    try {
      await onSettingsSave?.({
        ...settings,
        searchTeams: cleaned,
        typicalSearchWeeks: Math.max(1, draftWeeks || 1),
      })
      setEditing(false)
      toast.success('Search teams saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const setTeam = (i: number, patch: Partial<SearchTeam>) =>
    setDraftTeams((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  const setMember = (ti: number, mi: number, patch: Partial<SearchTeam['members'][number]>) =>
    setDraftTeams((prev) =>
      prev.map((t, j) =>
        j === ti
          ? { ...t, members: t.members.map((m, k) => (k === mi ? { ...m, ...patch } : m)) }
          : t
      )
    )

  const weeksCell = (weeks: number) => {
    if (weeks <= 0)
      return <span className="inline-block rounded-md px-2 py-0.5 bg-destructive/15 text-destructive font-semibold">—</span>
    const cls =
      weeks >= typical
        ? 'bg-success/15 text-success'
        : weeks >= typical / 2
          ? 'bg-warning/15 text-warning'
          : 'bg-destructive/15 text-destructive'
    return (
      <span className={cn('inline-block rounded-md px-2 py-0.5 font-semibold tabular-nums', cls)}>
        {weeks >= 20 ? '20+' : weeks.toFixed(1)} wks
      </span>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Recruiting budget</h3>
          <p className="text-xs text-muted-foreground">
            {`How many weeks of searching this deal can afford at each margin floor — a typical search runs ~${typical} weeks (green = fits).`}
          </p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            {engagement === 'recruiting'
              ? `The ${formatCurrency(r.revenue)} placement fee is all margin until search costs spend it down.`
              : `Before recruiting spend, this deal holds ${formatCurrency(r.laborMargin)} of margin (${formatPct(r.laborMarginPct)} of ${formatCurrency(r.revenue)} revenue).`}
          </p>
        </div>
        {onSettingsSave && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground flex-shrink-0"
            onClick={startEditing}
          >
            <Pencil size={12} />
            Edit
          </Button>
        )}
      </div>

      {/* Read-only live view — while editing it reflects the draft instantly,
          and its shape never changes so nothing jumps. */}
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="text-xs text-muted-foreground border-t border-border/40">
            <th className="text-left font-medium px-4 py-2 w-[30%]">Search team</th>
            <th className="text-right font-medium px-4 py-2 w-[14%]">$/week</th>
            {floors.map((f) => (
              <th key={f.label} className="text-right font-medium px-4 py-2 truncate">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Dollar budget at each floor */}
          <tr className="border-t border-border/40 bg-muted/20">
            <td className="px-4 py-2 font-medium text-muted-foreground" colSpan={2}>
              Budget available
            </td>
            {floors.map((f) => (
              <td
                key={f.label}
                className={cn(
                  'px-4 py-2 text-right tabular-nums font-semibold',
                  f.marginAvailable < 0 ? 'text-destructive' : 'text-foreground'
                )}
              >
                {formatCurrency(f.marginAvailable)}
              </td>
            ))}
          </tr>
          {/* Weeks of searching per team */}
          {teams.map((team, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="px-4 py-2">
                <div className="font-medium truncate">{team.label || '—'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {teamComposition(team)}
                </div>
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                {formatCurrency(teamWeeklyCost(team))}
              </td>
              {floors.map((f) => (
                <td key={f.label} className="px-4 py-2 text-right">
                  {weeksCell(f.weeksByTeam[i]?.weeks ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit strip: a proper form under the live table */}
      {editing && (
        <div className="border-t border-border/40 bg-muted/20 px-4 py-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Edit search teams
          </div>
          {draftTeams.map((team, ti) => (
            <div key={ti} className="rounded-lg border border-border/50 bg-card/60 p-2.5 space-y-1.5">
              {/* Team header: name + derived weekly cost + remove */}
              <div className="flex items-center gap-2">
                <Input
                  value={team.label}
                  placeholder="Team name"
                  onChange={(e) => setTeam(ti, { label: e.target.value })}
                  className="h-8 w-44 flex-shrink-0 bg-card font-medium placeholder:text-muted-foreground/40"
                />
                <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                  = {formatCurrency(teamWeeklyCost(team))}/wk
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground flex-shrink-0"
                  disabled={draftTeams.length <= 1}
                  onClick={() => setDraftTeams((prev) => prev.filter((_, j) => j !== ti))}
                >
                  <X size={13} />
                </Button>
              </div>
              {/* Members: role · $/hr · hrs/wk */}
              {team.members.map((m, mi) => (
                <div key={mi} className="flex items-center gap-2 pl-3">
                  <Input
                    value={m.role}
                    placeholder="Role — e.g. Mid recruiter"
                    onChange={(e) => setMember(ti, mi, { role: e.target.value })}
                    className="h-8 flex-1 min-w-0 bg-card text-sm placeholder:text-muted-foreground/40"
                  />
                  <div className="relative flex-shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      $
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={m.rate}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) setMember(ti, mi, { rate: n })
                      }}
                      className="h-8 w-24 pl-6 pr-8 text-right tabular-nums bg-card"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground pointer-events-none">
                      /hr
                    </span>
                  </div>
                  <div className="relative flex-shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={m.hoursPerWeek}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) setMember(ti, mi, { hoursPerWeek: n })
                      }}
                      className="h-8 w-28 pr-14 text-right tabular-nums bg-card"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground pointer-events-none">
                      hrs/wk
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground flex-shrink-0"
                    disabled={team.members.length <= 1}
                    onClick={() =>
                      setTeam(ti, { members: team.members.filter((_, k) => k !== mi) })
                    }
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
              <div className="pl-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={() =>
                    setTeam(ti, {
                      members: [...team.members, { role: '', rate: 75, hoursPerWeek: 20 }],
                    })
                  }
                >
                  <Plus size={12} />
                  Add member
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() =>
                  setDraftTeams((prev) => [
                    ...prev,
                    { label: '', members: [{ role: '', rate: 75, hoursPerWeek: 20 }] },
                  ])
                }
              >
                <Plus size={13} />
                Add team
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Typical search
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={draftWeeks}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setDraftWeeks(n)
                  }}
                  className="h-7 w-14 px-1.5 text-xs bg-card"
                />
                weeks
              </label>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
