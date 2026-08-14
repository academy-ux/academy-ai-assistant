'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatCurrency, formatPct } from '@/lib/utils'
import {
  computeDeal,
  currentSnapshot,
  emptyDraft,
  marginDrift,
  marginHealth,
  type DealStage,
  type MarginDeal,
  type MarginSettings,
} from '@/lib/margin-calc'
import { DriftChip, HEALTH_META } from '@/components/margin/health'
import { DealDialog, type DealDraft } from '@/components/margin/deal-dialog'

const STAGE_BADGE: Record<DealStage, string> = {
  estimate: 'bg-muted text-muted-foreground',
  placed: 'bg-accent/30 text-accent-foreground',
  completed: 'bg-primary/15 text-primary',
}

const STAGE_LABEL: Record<DealStage, string> = {
  estimate: 'Estimate',
  placed: 'Placed',
  completed: 'Completed',
}

export function DealsTable({
  deals,
  settings,
  onSaved,
  onDeleted,
}: {
  deals: MarginDeal[]
  settings: MarginSettings
  onSaved: (deal: MarginDeal) => void
  onDeleted: (id: string) => void
}) {
  const [selected, setSelected] = useState<DealDraft | null>(null)
  const [open, setOpen] = useState(false)

  const openDeal = (deal: DealDraft) => {
    setSelected(deal)
    setOpen(true)
  }

  const newDeal = () => {
    openDeal({
      id: crypto.randomUUID(),
      projectCode: '',
      roleTitle: '',
      client: '',
      contractor: '',
      engagementType: 'staffing',
      workerLocation: 'domestic',
      stage: 'estimate',
      // Domestic default → W-2 burden starts applied
      estimate: emptyDraft({ burdenPct: settings.employeeBurdenPct }),
      placed: null,
      actual: null,
      notes: '',
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {deals.length} deal{deals.length === 1 ? '' : 's'} · click a row to edit or advance its
          stage
        </p>
        <Button size="sm" className="gap-1.5" onClick={newDeal}>
          <Plus size={15} />
          New deal
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Role / Contractor</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">GPM</TableHead>
              <TableHead className="text-right">Drift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No deals yet — price one in the Calculator tab and save it, or add one here.
                </TableCell>
              </TableRow>
            )}
            {deals.map((deal) => {
              const current = currentSnapshot(deal)
              const result = current ? computeDeal(current.snapshot, deal.engagementType) : null
              const health = result ? marginHealth(result.marginPct, settings) : null
              return (
                <TableRow
                  key={deal.id}
                  className="cursor-pointer"
                  onClick={() => openDeal(deal)}
                >
                  <TableCell>
                    <div className="font-medium">{deal.projectCode}</div>
                    {deal.client && <div className="text-xs text-muted-foreground">{deal.client}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{deal.roleTitle || '—'}</div>
                    {deal.contractor && (
                      <div className="text-xs text-muted-foreground">{deal.contractor}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STAGE_BADGE[deal.stage]
                      )}
                    >
                      {STAGE_LABEL[deal.stage]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {result ? formatCurrency(result.revenue) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {result ? formatCurrency(result.margin) : '—'}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-semibold',
                      health && HEALTH_META[health].text
                    )}
                  >
                    {result ? formatPct(result.marginPct) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DriftChip pts={marginDrift(deal)} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <DealDialog
        deal={selected}
        settings={settings}
        open={open}
        onOpenChange={setOpen}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </div>
  )
}
