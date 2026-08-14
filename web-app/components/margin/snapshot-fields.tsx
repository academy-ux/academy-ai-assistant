'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { EngagementType, NullableSnapshot } from '@/lib/margin-calc'

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  placeholder,
  className,
  disabled = false,
  hint,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  prefix?: string
  suffix?: string
  step?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  hint?: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className, disabled && 'opacity-50')}>
      <Label className="text-xs text-muted-foreground inline-flex items-center gap-1">
        {label}
        {hint && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-xs">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          disabled={disabled}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return onChange(null)
            const n = Number(raw)
            if (Number.isFinite(n)) onChange(n)
          }}
          className={cn('h-9 placeholder:text-muted-foreground/40', prefix && 'pl-7', suffix && 'pr-14')}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

const RECRUITER_SPEND_HINT = (
  <div className="space-y-1.5">
    <p className="font-medium">Target: $5,000–$8,000 per placement.</p>
    <p>That assumes:</p>
    <ul className="list-disc pl-4 space-y-1">
      <li>one mid level recruiter at $75/hr, 20 hrs/week for 3 weeks (~$4,500)</li>
      <li>one sourcing recruiter at $12/hr, 40 hrs/week for 4 weeks (~$1,920)</li>
    </ul>
  </div>
)

// Shared numeric inputs for one stage snapshot. Blank fields stay null so
// callers can distinguish "not entered yet" from an explicit 0; every field
// keeps its slot regardless of toggles so switching never reflows.
// Staffing shows the hourly model; recruiting shows salary × placement fee.
export function SnapshotFields({
  value,
  onChange,
  engagement = 'staffing',
  burdenApplies,
  showTotalHoursOverride = false,
}: {
  value: NullableSnapshot
  onChange: (next: NullableSnapshot) => void
  engagement?: EngagementType
  burdenApplies: boolean // domestic (W-2) talent → burden editable
  showTotalHoursOverride?: boolean
}) {
  const set = (patch: Partial<NullableSnapshot>) => onChange({ ...value, ...patch })
  const hoursPlaceholder =
    value.weeks !== null && value.hoursPerWeek !== null
      ? `${value.weeks * value.hoursPerWeek} from weeks × hrs/week`
      : 'e.g. 480'

  if (engagement === 'recruiting') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="First-year salary"
          prefix="$"
          step={5000}
          placeholder="140,000"
          className="col-span-2"
          value={value.salary}
          onChange={(v) => set({ salary: v })}
        />
        <NumberField
          label="Placement fee"
          suffix="%"
          step={1}
          placeholder="20"
          hint="Academy's fee as a percentage of the hire's first-year base salary. The client pays the salary; the fee is our revenue."
          value={value.feePct !== null ? Math.round(value.feePct * 1000) / 10 : null}
          onChange={(v) => set({ feePct: v === null ? null : v / 100 })}
        />
        <NumberField
          label="Recruiter spend"
          prefix="$"
          step={100}
          placeholder="0"
          hint={RECRUITER_SPEND_HINT}
          value={value.recruiterSpend}
          onChange={(v) => set({ recruiterSpend: v })}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        label="Billable rate"
        prefix="$"
        suffix="/hr"
        step={5}
        placeholder="185"
        value={value.billRate}
        onChange={(v) => set({ billRate: v })}
      />
      <NumberField
        label="Cost rate"
        prefix="$"
        suffix="/hr"
        step={5}
        placeholder="125"
        value={value.costRate}
        onChange={(v) => set({ costRate: v })}
      />
      <NumberField
        label="Weeks"
        placeholder="12"
        value={value.weeks}
        onChange={(v) => set({ weeks: v })}
      />
      <NumberField
        label="Hours / week"
        placeholder="40"
        value={value.hoursPerWeek}
        onChange={(v) => set({ hoursPerWeek: v })}
      />
      {showTotalHoursOverride && (
        <NumberField
          label="Actual total hours (overrides weeks × hrs)"
          className="col-span-2"
          value={value.totalHoursOverride}
          placeholder={hoursPlaceholder}
          onChange={(v) => set({ totalHoursOverride: v })}
        />
      )}
      <NumberField
        label="Recruiter spend"
        prefix="$"
        step={100}
        placeholder="0"
        hint={RECRUITER_SPEND_HINT}
        value={value.recruiterSpend}
        onChange={(v) => set({ recruiterSpend: v })}
      />
      <NumberField
        label="Employment burden"
        suffix="%"
        step={1}
        placeholder="0"
        hint="Extra employer costs on W-2 payroll — FICA taxes, unemployment insurance, JustWorks, and compliance — added on top of the cost rate. Doesn't apply to international contractors."
        disabled={!burdenApplies}
        value={value.burdenPct !== null ? Math.round(value.burdenPct * 1000) / 10 : null}
        onChange={(v) => set({ burdenPct: v === null ? null : v / 100 })}
      />
    </div>
  )
}
