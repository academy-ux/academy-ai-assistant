'use client'

// Dev-only visual preview of the calculator UI with sample data, so layout
// and interactions can be checked without signing in. Hidden in production.
import { useState } from 'react'
import { notFound } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_SETTINGS, type MarginDeal } from '@/lib/margin-calc'
import { MarginCalculator } from '@/components/margin/margin-calculator'
import { DealsTable } from '@/components/margin/deals-table'
import { Portfolio } from '@/components/margin/portfolio'
import { SettingsDialog } from '@/components/margin/settings-dialog'

const SAMPLE_DEALS: MarginDeal[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    projectCode: 'HUSH012',
    roleTitle: 'Senior Product Designer',
    client: 'Hush',
    contractor: 'Casey Wu',
    engagementType: 'staffing',
    workerLocation: 'international',
    stage: 'completed',
    estimate: {
      billRate: 100, costRate: 81.25, weeks: 6, hoursPerWeek: 27,
      totalHoursOverride: null, burdenPct: 0, salary: 0, feePct: 0, recruiterSpend: 0,
    },
    placed: {
      billRate: 100, costRate: 81.25, weeks: 6, hoursPerWeek: 27,
      totalHoursOverride: null, burdenPct: 0, salary: 0, feePct: 0, recruiterSpend: 500,
    },
    actual: {
      billRate: 100, costRate: 81.25, weeks: 6, hoursPerWeek: 27,
      totalHoursOverride: 160, burdenPct: 0, salary: 0, feePct: 0, recruiterSpend: 500,
    },
    notes: '',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    projectCode: 'DELIVERR005',
    roleTitle: 'Senior UX Designer',
    client: 'Deliverr',
    contractor: 'Asim Khan',
    engagementType: 'staffing',
    workerLocation: 'international',
    stage: 'placed',
    estimate: {
      billRate: 150, costRate: 100, weeks: 12, hoursPerWeek: 40,
      totalHoursOverride: null, burdenPct: 0, salary: 0, feePct: 0, recruiterSpend: 0,
    },
    placed: {
      billRate: 150, costRate: 105, weeks: 12, hoursPerWeek: 40,
      totalHoursOverride: null, burdenPct: 0, salary: 0, feePct: 0, recruiterSpend: 3200,
    },
    actual: null,
    notes: '',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    projectCode: 'FAW002',
    roleTitle: 'Mid-Level Product Designer',
    client: 'FAW',
    contractor: '',
    engagementType: 'recruiting',
    workerLocation: 'domestic',
    stage: 'estimate',
    estimate: {
      billRate: 0, costRate: 0, weeks: 0, hoursPerWeek: 0,
      totalHoursOverride: null, burdenPct: 0, salary: 130000, feePct: 0.2, recruiterSpend: 6400,
    },
    placed: null,
    actual: null,
    notes: '',
  },
]

export default function MarginPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <PreviewInner />
}

function PreviewInner() {
  const [deals, setDeals] = useState<MarginDeal[]>(SAMPLE_DEALS)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('calculator')

  const upsertDeal = (deal: MarginDeal) =>
    setDeals((prev) => {
      const i = prev.findIndex((d) => d.id === deal.id)
      if (i === -1) return [deal, ...prev]
      const next = [...prev]
      next[i] = deal
      return next
    })

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calculator (dev preview)</h1>
          <p className="text-sm text-muted-foreground">
            Price placements, budget recruiting, and track margin from estimate to actuals
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={15} />
          Settings
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="deals">Deals{deals.length > 0 && ` (${deals.length})`}</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>
        <TabsContent value="calculator">
          <MarginCalculator settings={settings} onDealSaved={(d) => { upsertDeal(d); setTab('deals') }} onSettingsSave={(s) => setSettings(s)} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTable deals={deals} settings={settings} onSaved={upsertDeal} onDeleted={(id) => setDeals((p) => p.filter((d) => d.id !== id))} />
        </TabsContent>
        <TabsContent value="portfolio">
          <Portfolio deals={deals} settings={settings} />
        </TabsContent>
      </Tabs>

      <SettingsDialog
        settings={settings}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={setSettings}
      />
    </div>
  )
}
