'use client'

import { cn, formatPct } from '@/lib/utils'
import type { MarginHealth } from '@/lib/margin-calc'

export const HEALTH_META: Record<
  MarginHealth,
  { label: string; badge: string; cell: string; bar: string; text: string }
> = {
  loss: {
    label: 'Losing money',
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    cell: 'bg-destructive/15 text-destructive',
    bar: 'bg-destructive',
    text: 'text-destructive',
  },
  thin: {
    label: 'Below minimum',
    badge: 'bg-warning/15 text-warning border-warning/30',
    cell: 'bg-warning/15 text-warning',
    bar: 'bg-warning',
    text: 'text-warning',
  },
  acceptable: {
    label: 'Acceptable',
    badge: 'bg-success/10 text-success border-success/20',
    cell: 'bg-success/10 text-success/80',
    bar: 'bg-success/60',
    text: 'text-success/90',
  },
  healthy: {
    label: 'Healthy',
    badge: 'bg-success/20 text-success border-success/30',
    cell: 'bg-success/25 text-success',
    bar: 'bg-success',
    text: 'text-success',
  },
}

export function HealthBadge({ health, className }: { health: MarginHealth; className?: string }) {
  const meta = HEALTH_META[health]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        meta.badge,
        className
      )}
    >
      {meta.label}
    </span>
  )
}

// Small +x.x / −x.x pts chip for estimate → current margin drift.
export function DriftChip({ pts }: { pts: number | null }) {
  if (pts === null) return <span className="text-xs text-muted-foreground">—</span>
  const eroded = pts < -0.05
  const improved = pts > 0.05
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        eroded && 'bg-destructive/15 text-destructive',
        improved && 'bg-success/15 text-success',
        !eroded && !improved && 'bg-muted text-muted-foreground'
      )}
      title="Margin now vs. original estimate, in percentage points"
    >
      {pts > 0 ? '+' : ''}
      {pts.toFixed(1)} pts
    </span>
  )
}

export function pctLabel(fraction: number) {
  return formatPct(fraction, 1)
}
