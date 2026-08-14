'use client'

import { cn, formatCurrency, formatPct } from '@/lib/utils'
import {
  computeDeal,
  currentSnapshot,
  marginDrift,
  marginHealth,
  portfolioTotals,
  type MarginDeal,
  type MarginSettings,
} from '@/lib/margin-calc'
import { DriftChip, HEALTH_META, HealthBadge } from '@/components/margin/health'

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-2xl font-semibold tracking-tight', valueClass)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// Roll-up across every deal, valued at its most advanced stage. Sorted with
// the weakest margins on top so the deals that need attention surface first.
export function Portfolio({
  deals,
  settings,
}: {
  deals: MarginDeal[]
  settings: MarginSettings
}) {
  const totals = portfolioTotals(deals, settings)
  const blendedHealth = marginHealth(totals.blendedMarginPct, settings)

  const rows = deals
    .map((deal) => {
      const current = currentSnapshot(deal)
      if (!current) return null
      const result = computeDeal(current.snapshot, deal.engagementType)
      if (result.revenue <= 0) return null
      return {
        deal,
        stage: current.stage,
        result,
        health: marginHealth(result.marginPct, settings),
        drift: marginDrift(deal),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.result.marginPct - b.result.marginPct)

  const maxRevenue = Math.max(1, ...rows.map((r) => r.result.revenue))

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        The portfolio view fills in as you save deals with numbers.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Booked revenue"
          value={formatCurrency(totals.revenue)}
          sub={`${totals.count} active deal${totals.count === 1 ? '' : 's'} · ${totals.totalHours.toLocaleString()} hrs`}
        />
        <StatCard label="Total cost" value={formatCurrency(totals.totalCost)} />
        <StatCard
          label="Total margin"
          value={formatCurrency(totals.margin)}
          valueClass={HEALTH_META[blendedHealth].text}
        />
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Blended margin</div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-2xl font-semibold tracking-tight',
                HEALTH_META[blendedHealth].text
              )}
            >
              {formatPct(totals.blendedMarginPct)}
            </span>
            <HealthBadge health={blendedHealth} />
          </div>
          {totals.belowMinimumCount > 0 && (
            <div className="text-xs text-destructive mt-0.5">
              {totals.belowMinimumCount} deal{totals.belowMinimumCount === 1 ? '' : 's'} below the{' '}
              {Math.round(settings.minimumMarginPct * 100)}% minimum
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-sm font-semibold">Margin by deal</h3>
          <p className="text-xs text-muted-foreground">
            Weakest margins first · bar length is revenue at the deal&apos;s current stage
          </p>
        </div>
        <div className="divide-y divide-border/40">
          {rows.map(({ deal, stage, result, health, drift }) => (
            <div key={deal.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">{deal.projectCode}</span>
                  {deal.roleTitle && (
                    <span className="text-xs text-muted-foreground truncate">{deal.roleTitle}</span>
                  )}
                  <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
                    {stage === 'completed' ? 'actual' : stage}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <DriftChip pts={drift} />
                  <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                    {formatCurrency(result.margin)}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums w-14 text-right',
                      HEALTH_META[health].text
                    )}
                  >
                    {formatPct(result.marginPct, 0)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', HEALTH_META[health].bar)}
                  style={{ width: `${Math.max(2, (result.revenue / maxRevenue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
