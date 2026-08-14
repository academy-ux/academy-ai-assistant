'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'
import {
  coerceSnapshot,
  emptyDraft,
  isSnapshotComplete,
  type EngagementType,
  type MarginDeal,
  type MarginSettings,
  type NullableSnapshot,
  type StageSnapshot,
  type WorkerLocation,
} from '@/lib/margin-calc'
import { SnapshotFields } from '@/components/margin/snapshot-fields'
import { RecruitingBudget, ResultsPanel } from '@/components/margin/results-panel'
import { SensitivityGrid } from '@/components/margin/sensitivity-grid'

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function MarginCalculator({
  settings,
  onDealSaved,
  onSettingsSave,
}: {
  settings: MarginSettings
  onDealSaved: (deal: MarginDeal) => void
  onSettingsSave?: (next: MarginSettings) => Promise<void> | void
}) {
  const [engagementType, setEngagementType] = useState<EngagementType>('staffing')
  const [location, setLocation] = useState<WorkerLocation>('domestic')
  // Domestic is the default, so the W-2 burden starts applied.
  const [draft, setDraft] = useState<NullableSnapshot>(() =>
    emptyDraft({ burdenPct: settings.employeeBurdenPct })
  )
  const [saveOpen, setSaveOpen] = useState(false)
  // Which rate-card preset the current rates came from ('' = custom/unset)
  const [preset, setPreset] = useState('')

  // Live results: recompute on every keystroke once the inputs are complete.
  const snapshot: StageSnapshot | null = useMemo(
    () => (isSnapshotComplete(draft, engagementType) ? coerceSnapshot(draft) : null),
    [draft, engagementType]
  )

  const applyEngagement = (type: EngagementType) => {
    setEngagementType(type)
    // First switch into recruiting mode starts from the default placement fee
    if (type === 'recruiting') {
      setDraft((s) => ({ ...s, feePct: s.feePct ?? settings.placementFeePct }))
    }
  }

  const applyLocation = (loc: WorkerLocation) => {
    setLocation(loc)
    setDraft((s) => ({ ...s, burdenPct: loc === 'domestic' ? settings.employeeBurdenPct : 0 }))
  }

  const applyPreset = (key: string) => {
    setPreset(key)
    if (key === 'none') {
      setDraft((s) => ({ ...s, billRate: null, costRate: null }))
      return
    }
    const row = settings.rateCard[Number(key)]
    if (row) setDraft((s) => ({ ...s, billRate: row.billRate, costRate: row.costRate }))
  }

  // Manual rate edits mean the preset no longer describes the inputs.
  const onFieldsChange = (next: NullableSnapshot) => {
    if (next.billRate !== draft.billRate || next.costRate !== draft.costRate) setPreset('')
    setDraft(next)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
      {/* Inputs */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Engagement</Label>
          <Segmented
            value={engagementType}
            onChange={applyEngagement}
            options={[
              { value: 'staffing', label: 'Staffing' },
              { value: 'recruiting', label: 'Recruiting' },
            ]}
          />
          {/* Fixed-height helper line so toggling never shifts the layout */}
          <p className="text-xs text-muted-foreground min-h-8">
            {engagementType === 'recruiting'
              ? 'Full-time hire on the client’s payroll — Academy earns a placement fee on the salary.'
              : 'Contract role billed hourly through Academy.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Talent</Label>
          <Segmented
            value={location}
            onChange={applyLocation}
            options={[
              { value: 'domestic', label: 'Domestic' },
              { value: 'international', label: 'International' },
            ]}
          />
          {/* Fixed-height helper line so toggling never shifts the layout */}
          <p className="text-xs text-muted-foreground min-h-8">
            {engagementType === 'recruiting'
              ? 'The hire goes on the client’s payroll, so no employment burden either way.'
              : location === 'domestic'
                ? `W-2 employee — the ${Math.round(settings.employeeBurdenPct * 100)}% employment burden (FICA, insurance, compliance) applies.`
                : 'Paid as a contractor — no employment burden.'}
          </p>
        </div>

        {engagementType === 'staffing' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Rate card preset</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pick a level…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None — enter rates manually</span>
                </SelectItem>
                {settings.rateCard.map((row, i) => (
                  <SelectItem key={`${row.level}-${row.band}-${i}`} value={String(i)}>
                    {row.level} · {row.band} — ${row.costRate} cost / ${row.billRate} bill
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <SnapshotFields
          value={draft}
          onChange={onFieldsChange}
          engagement={engagementType}
          burdenApplies={location === 'domestic'}
        />

        <div className="space-y-2">
          {/* Always rendered (disabled until complete) so the card never resizes */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={!snapshot}
            onClick={() => setSaveOpen(true)}
          >
            <Save size={15} />
            Save as deal
          </Button>
          <p className="text-xs text-muted-foreground text-center min-h-4">
            {snapshot
              ? ''
              : engagementType === 'recruiting'
                ? 'Enter a salary and placement fee'
                : 'Enter both rates and a duration'}
          </p>
        </div>
      </div>

      {/* Live results */}
      <div className="space-y-4 min-w-0">
        <ResultsPanel snapshot={snapshot} settings={settings} engagement={engagementType} />
        {snapshot && (
          <>
            <RecruitingBudget
              snapshot={snapshot}
              settings={settings}
              engagement={engagementType}
              onSettingsSave={onSettingsSave}
            />
            {engagementType === 'staffing' && <SensitivityGrid snapshot={snapshot} settings={settings} />}
          </>
        )}
      </div>

      {snapshot && (
        <SaveDealDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          snapshot={snapshot}
          engagementType={engagementType}
          workerLocation={location}
          onSaved={onDealSaved}
        />
      )}
    </div>
  )
}

function SaveDealDialog({
  open,
  onOpenChange,
  snapshot,
  engagementType,
  workerLocation,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: StageSnapshot
  engagementType: EngagementType
  workerLocation: WorkerLocation
  onSaved: (deal: MarginDeal) => void
}) {
  const [projectCode, setProjectCode] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [client, setClient] = useState('')
  const [contractor, setContractor] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!projectCode.trim()) {
      toast.error('Project code is required')
      return
    }
    setSaving(true)
    const deal: MarginDeal = {
      id: crypto.randomUUID(),
      projectCode: projectCode.trim(),
      roleTitle: roleTitle.trim(),
      client: client.trim(),
      contractor: contractor.trim(),
      engagementType,
      workerLocation,
      stage: 'estimate',
      estimate: { ...snapshot, updatedAt: new Date().toISOString() },
      placed: null,
      actual: null,
      notes: '',
    }
    try {
      const res = await fetch('/api/margin/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deal),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      onSaved(deal)
      toast.success(`${deal.projectCode} saved to deals`)
      onOpenChange(false)
      setProjectCode('')
      setRoleTitle('')
      setClient('')
      setContractor('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as deal</DialogTitle>
          <DialogDescription>
            Saves the current numbers as this deal&apos;s estimate. You&apos;ll update it as the
            placement progresses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Project code *</Label>
            <Input
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              placeholder="HUSH012"
              className="h-9 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Client</Label>
            <Input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Hush"
              className="h-9 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Senior Product Designer"
              className="h-9 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Contractor / candidate</Label>
            <Input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="TBD while sourcing"
              className="h-9 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
