'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { cn, formatCurrency, formatPct } from '@/lib/utils'
import {
  coerceSnapshot,
  computeDeal,
  emptyDraft,
  isSnapshotBlank,
  isSnapshotComplete,
  marginDrift,
  marginHealth,
  type DealStage,
  type EngagementType,
  type MarginDeal,
  type MarginSettings,
  type NullableSnapshot,
  type WorkerLocation,
} from '@/lib/margin-calc'
import { DriftChip, HealthBadge } from '@/components/margin/health'
import { SnapshotFields } from '@/components/margin/snapshot-fields'

// A deal while it's being edited: stage numbers may be partially blank.
export type DealDraft = Omit<MarginDeal, 'estimate' | 'placed' | 'actual'> & {
  estimate: NullableSnapshot | null
  placed: NullableSnapshot | null
  actual: NullableSnapshot | null
}

const STAGE_LABEL: Record<DealStage, string> = {
  estimate: 'Estimate',
  placed: 'Placed',
  completed: 'Completed',
}

const STAGE_SNAPSHOT_KEY: Record<DealStage, 'estimate' | 'placed' | 'actual'> = {
  estimate: 'estimate',
  placed: 'placed',
  completed: 'actual',
}

const STAGE_ORDER: DealStage[] = ['estimate', 'placed', 'completed']

// Blank snapshots save as "no numbers yet"; partial ones block the save so a
// half-filled stage can never masquerade as a $0 deal.
function finalizeStages(
  draft: DealDraft
): { deal: MarginDeal; error: null } | { deal: null; error: string } {
  const out: Record<'estimate' | 'placed' | 'actual', MarginDeal['estimate']> = {
    estimate: null,
    placed: null,
    actual: null,
  }
  for (const stage of STAGE_ORDER) {
    const key = STAGE_SNAPSHOT_KEY[stage]
    const snap = draft[key]
    if (!snap || isSnapshotBlank(snap)) continue
    if (!isSnapshotComplete(snap, draft.engagementType)) {
      const needed =
        draft.engagementType === 'recruiting'
          ? 'fill a salary and placement fee'
          : 'fill both rates and a duration'
      return {
        deal: null,
        error: `${STAGE_LABEL[stage]} numbers are incomplete — ${needed}, or clear them.`,
      }
    }
    out[key] = coerceSnapshot(snap)
  }
  return { deal: { ...draft, ...out }, error: null }
}

// View/edit one deal: metadata, stage progression, and the snapshot numbers
// for every stage reached so far. Advancing a stage copies the previous
// snapshot forward so actuals start from the placed terms.
export function DealDialog({
  deal,
  settings,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  deal: DealDraft | null
  settings: MarginSettings
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (deal: MarginDeal) => void
  onDeleted: (id: string) => void
}) {
  const [draft, setDraft] = useState<DealDraft | null>(deal)
  const [activeStage, setActiveStage] = useState<DealStage>('estimate')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setDraft(deal ? structuredClone(deal) : null)
    setActiveStage(deal?.stage ?? 'estimate')
  }, [deal, open])

  // Live view of the deal with only its complete stages, for header badges.
  const coercedView: MarginDeal | null = useMemo(() => {
    if (!draft) return null
    const result = finalizeStages(draft)
    return result.deal
  }, [draft])

  if (!draft) return null

  const set = (patch: Partial<DealDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  // Switching talent location re-applies the burden rule to every stage's
  // numbers so no snapshot is left carrying the wrong classification.
  const applyLocation = (loc: WorkerLocation) => {
    setDraft((d) => {
      if (!d) return d
      const burdenPct = loc === 'domestic' ? settings.employeeBurdenPct : 0
      const patch = (snap: NullableSnapshot | null) => (snap ? { ...snap, burdenPct } : snap)
      return {
        ...d,
        workerLocation: loc,
        estimate: patch(d.estimate),
        placed: patch(d.placed),
        actual: patch(d.actual),
      }
    })
  }

  const reachedStages = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(draft.stage) + 1)
  const activeKey = STAGE_SNAPSHOT_KEY[activeStage]
  const activeSnapshot = draft[activeKey]

  const nextStage: DealStage | null =
    draft.stage === 'estimate' ? 'placed' : draft.stage === 'placed' ? 'completed' : null

  const advance = () => {
    if (!nextStage) return
    const key = STAGE_SNAPSHOT_KEY[nextStage]
    const prevKey = STAGE_SNAPSHOT_KEY[draft.stage]
    const carried: NullableSnapshot =
      draft[key] ?? structuredClone(draft[prevKey] ?? emptyDraft())
    carried.updatedAt = new Date().toISOString()
    setDraft({ ...draft, stage: nextStage, [key]: carried })
    setActiveStage(nextStage)
  }

  const save = async () => {
    if (!draft.projectCode.trim()) {
      toast.error('Project code is required')
      return
    }
    const finalized = finalizeStages(draft)
    if (!finalized.deal) {
      toast.error(finalized.error)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/margin/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalized.deal),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      onSaved(finalized.deal)
      toast.success(`${draft.projectCode} saved`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/margin/deals?id=${draft.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Delete failed')
      }
      onDeleted(draft.id)
      toast.success(`${draft.projectCode || 'Deal'} deleted`)
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const activeComplete = activeSnapshot
    ? isSnapshotComplete(activeSnapshot, draft.engagementType)
    : false
  const result =
    activeSnapshot && activeComplete
      ? computeDeal(coerceSnapshot(activeSnapshot), draft.engagementType)
      : null
  const drift = coercedView ? marginDrift(coercedView) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {draft.projectCode || 'New deal'}
            {result && <HealthBadge health={marginHealth(result.marginPct, settings)} />}
            {drift !== null && <DriftChip pts={drift} />}
          </DialogTitle>
          <DialogDescription>
            {draft.engagementType === 'recruiting' ? 'Recruiting' : 'Staffing'} ·{' '}
            {draft.workerLocation === 'domestic' ? 'Domestic (W-2)' : 'International (contractor)'}
            {draft.client && ` · ${draft.client}`}
          </DialogDescription>
        </DialogHeader>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Project code *</Label>
            <Input value={draft.projectCode} onChange={(e) => set({ projectCode: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Client</Label>
            <Input value={draft.client} onChange={(e) => set({ client: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Input value={draft.roleTitle} onChange={(e) => set({ roleTitle: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contractor</Label>
            <Input value={draft.contractor} onChange={(e) => set({ contractor: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Engagement</Label>
            <Select
              value={draft.engagementType}
              onValueChange={(v) => set({ engagementType: v as EngagementType })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staffing">Staffing</SelectItem>
                <SelectItem value="recruiting">Recruiting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Talent</Label>
            <Select value={draft.workerLocation} onValueChange={(v) => applyLocation(v as WorkerLocation)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="domestic">Domestic (W-2)</SelectItem>
                <SelectItem value="international">International (contractor)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stage progression */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1">
            {STAGE_ORDER.map((stage, i) => {
              const reached = reachedStages.includes(stage)
              return (
                <div key={stage} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50 text-xs">→</span>}
                  <button
                    disabled={!reached}
                    onClick={() => setActiveStage(stage)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      activeStage === stage && reached
                        ? 'bg-primary text-primary-foreground'
                        : reached
                          ? 'bg-card text-foreground hover:bg-primary/10'
                          : 'text-muted-foreground/50 cursor-not-allowed'
                    )}
                  >
                    {STAGE_LABEL[stage]}
                  </button>
                </div>
              )
            })}
          </div>
          {nextStage && (
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={advance}>
              Advance to {STAGE_LABEL[nextStage]}
              <ArrowRight size={13} />
            </Button>
          )}
        </div>

        {/* Snapshot numbers for the selected stage */}
        {activeSnapshot ? (
          <div className="space-y-3">
            <SnapshotFields
              value={activeSnapshot}
              onChange={(next) => set({ [activeKey]: next } as Partial<DealDraft>)}
              engagement={draft.engagementType}
              burdenApplies={draft.workerLocation === 'domestic'}
              showTotalHoursOverride={draft.engagementType === 'staffing' && activeStage !== 'estimate'}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm min-h-10">
              {result ? (
                <>
                  <span>
                    <span className="text-muted-foreground text-xs">Revenue </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(result.revenue)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">Cost </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(result.totalCost)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">Margin </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(result.margin)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">GPM </span>
                    <span className="font-semibold tabular-nums">{formatPct(result.marginPct)}</span>
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {draft.engagementType === 'recruiting'
                    ? 'Enter a salary and placement fee to see this stage’s margins.'
                    : 'Enter both rates and a duration to see this stage’s margins.'}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground px-1">No numbers for this stage yet.</p>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            placeholder="Rate negotiation context, scope changes…"
          />
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${draft.projectCode || 'this deal'}?`}
        description="This permanently removes the deal and all of its stage snapshots."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={remove}
      />
    </Dialog>
  )
}
