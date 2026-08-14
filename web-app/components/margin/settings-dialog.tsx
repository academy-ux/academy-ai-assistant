'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
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
import type { MarginSettings } from '@/lib/margin-calc'

function PctField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={1}
          min={0}
          max={100}
          value={Math.round(value * 1000) / 10}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(n / 100)
          }}
          className="h-9 pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          %
        </span>
      </div>
    </div>
  )
}

export function SettingsDialog({
  settings,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: MarginSettings
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (settings: MarginSettings) => void
}) {
  const [draft, setDraft] = useState<MarginSettings>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(structuredClone(settings))
  }, [open, settings])

  const save = async () => {
    if (draft.healthyMarginPct < draft.minimumMarginPct) {
      toast.error('Healthy margin must be at or above the minimum')
      return
    }
    if (draft.recruiterRates.some((r) => !r.label.trim())) {
      toast.error('Every recruiter tier needs a label')
      return
    }
    if (draft.searchTeams.some((t) => !t.label.trim())) {
      toast.error('Every search team needs a label')
      return
    }
    if (draft.rateCard.some((r) => !r.level.trim())) {
      toast.error('Every rate card row needs a level')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/margin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      onSaved(draft)
      toast.success('Settings saved')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calculator settings</DialogTitle>
          <DialogDescription>
            Thresholds, burden, and rate cards used everywhere on this page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <PctField
            label="Minimum margin"
            value={draft.minimumMarginPct}
            onChange={(v) => setDraft({ ...draft, minimumMarginPct: v })}
          />
          <PctField
            label="Healthy margin"
            value={draft.healthyMarginPct}
            onChange={(v) => setDraft({ ...draft, healthyMarginPct: v })}
          />
          <PctField
            label="W-2 burden (domestic)"
            value={draft.employeeBurdenPct}
            onChange={(v) => setDraft({ ...draft, employeeBurdenPct: v })}
          />
          <PctField
            label="Placement fee (recruiting)"
            value={draft.placementFeePct}
            onChange={(v) => setDraft({ ...draft, placementFeePct: v })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Recruiter rates ($/hr)</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                setDraft({
                  ...draft,
                  recruiterRates: [...draft.recruiterRates, { label: '', rate: 75 }],
                })
              }
            >
              <Plus size={13} /> Add tier
            </Button>
          </div>
          {draft.recruiterRates.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={r.label}
                placeholder="Tier (e.g. Senior)"
                onChange={(e) => {
                  const next = [...draft.recruiterRates]
                  next[i] = { ...r, label: e.target.value }
                  setDraft({ ...draft, recruiterRates: next })
                }}
                className="h-9"
              />
              <Input
                type="number"
                value={r.rate}
                min={0}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  const next = [...draft.recruiterRates]
                  next[i] = { ...r, rate: n }
                  setDraft({ ...draft, recruiterRates: next })
                }}
                className="h-9 w-28"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground"
                disabled={draft.recruiterRates.length <= 1}
                onClick={() =>
                  setDraft({
                    ...draft,
                    recruiterRates: draft.recruiterRates.filter((_, j) => j !== i),
                  })
                }
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Search teams (members, rates, and hours) are edited directly on the Recruiting budget
          card via its Edit button.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Level rate card (cost / bill $/hr)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                setDraft({
                  ...draft,
                  rateCard: [
                    ...draft.rateCard,
                    { level: '', band: 'Low-end', costRate: 80, billRate: 185 },
                  ],
                })
              }
            >
              <Plus size={13} /> Add row
            </Button>
          </div>
          {draft.rateCard.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={row.level}
                placeholder="Level"
                onChange={(e) => {
                  const next = [...draft.rateCard]
                  next[i] = { ...row, level: e.target.value }
                  setDraft({ ...draft, rateCard: next })
                }}
                className="h-9 flex-1"
              />
              <Select
                value={row.band}
                onValueChange={(band) => {
                  const next = [...draft.rateCard]
                  next[i] = { ...row, band: band as 'Low-end' | 'High-end' }
                  setDraft({ ...draft, rateCard: next })
                }}
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low-end">Low-end</SelectItem>
                  <SelectItem value="High-end">High-end</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={row.costRate}
                min={0}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  const next = [...draft.rateCard]
                  next[i] = { ...row, costRate: n }
                  setDraft({ ...draft, rateCard: next })
                }}
                className="h-9 w-20"
              />
              <Input
                type="number"
                value={row.billRate}
                min={0}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n)) return
                  const next = [...draft.rateCard]
                  next[i] = { ...row, billRate: n }
                  setDraft({ ...draft, rateCard: next })
                }}
                className="h-9 w-20"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground"
                onClick={() =>
                  setDraft({ ...draft, rateCard: draft.rateCard.filter((_, j) => j !== i) })
                }
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
