'use client'

import { cn, formatCurrency } from '@/lib/utils'
import { sensitivityGrid, type MarginSettings, type StageSnapshot } from '@/lib/margin-calc'
import { HEALTH_META } from '@/components/margin/health'

// Cost rate × engagement length heatmap: the negotiating-room map. Each cell
// is total margin $ (and %) at that rate for that duration.
export function SensitivityGrid({
  snapshot,
  settings,
}: {
  snapshot: StageSnapshot
  settings: MarginSettings
}) {
  const rows = sensitivityGrid(snapshot, settings)
  const weeksList = rows[0]?.cells.map((c) => c.weeks) ?? []

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold">Rate sensitivity</h3>
        <p className="text-xs text-muted-foreground">
          Margin at nearby cost rates and engagement lengths ({snapshot.hoursPerWeek} hrs/week
          {snapshot.burdenPct > 0 ? ', burdened' : ''})
        </p>
      </div>
      <div className="overflow-x-auto">
        {/* table-fixed + min-w: columns hold still as values change; narrow screens scroll */}
        <table className="w-full text-xs table-fixed min-w-[720px]">
          <thead>
            <tr className="border-t border-border/40 text-muted-foreground">
              <th className="text-left font-medium px-4 py-2 whitespace-nowrap w-24">Cost rate</th>
              {weeksList.map((w) => (
                <th key={w} className="text-right font-medium px-3 py-2 whitespace-nowrap">
                  {w} wks
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.costRate}
                className={cn('border-t border-border/40', row.isCurrent && 'bg-primary/5')}
              >
                <td className={cn('px-4 py-1.5 whitespace-nowrap tabular-nums', row.isCurrent ? 'font-bold' : 'font-medium')}>
                  {formatCurrency(row.costRate)}
                  {row.isCurrent && <span className="ml-1 text-2xs text-primary">current</span>}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.weeks} className="px-1 py-1">
                    <div className={cn('rounded-md px-2 py-1 text-right tabular-nums', HEALTH_META[cell.health].cell)}>
                      <div className="font-semibold">{(cell.marginPct * 100).toFixed(0)}%</div>
                      <div className="opacity-75">{formatCurrency(cell.margin)}</div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
