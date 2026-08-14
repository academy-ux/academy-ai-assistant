'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MarginDeal, MarginSettings } from '@/lib/margin-calc'
import { MarginCalculator } from '@/components/margin/margin-calculator'
import { DealsTable } from '@/components/margin/deals-table'
import { Portfolio } from '@/components/margin/portfolio'
import { SettingsDialog } from '@/components/margin/settings-dialog'

export default function MarginPage() {
  const { data: session, status } = useSession()
  const allowed = status !== 'authenticated' || Boolean((session?.user as any)?.isAdmin)

  const [deals, setDeals] = useState<MarginDeal[]>([])
  const [settings, setSettings] = useState<MarginSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('calculator')

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/margin')
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load')
        return
      }
      setDeals(body.deals)
      setSettings(body.settings)
    } catch {
      setError('Failed to load the profitability data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && allowed) load()
    if (status === 'unauthenticated') setLoading(false)
  }, [status, allowed, load])

  const upsertDeal = (deal: MarginDeal) =>
    setDeals((prev) => {
      const i = prev.findIndex((d) => d.id === deal.id)
      if (i === -1) return [deal, ...prev]
      const next = [...prev]
      next[i] = deal
      return next
    })

  const removeDeal = (id: string) => setDeals((prev) => prev.filter((d) => d.id !== id))

  if (status === 'authenticated' && !allowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-md bg-card border border-border/60 rounded-xl p-6 text-center animate-fade-in-up">
          <h2 className="text-base font-semibold text-foreground mb-2">Admins only</h2>
          <p className="text-sm text-muted-foreground">
            The profitability calculator is limited to admins. Ask Adam if you need access.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground animate-pulse">Loading profitability…</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground">Sign in to view the profitability calculator.</div>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-md bg-card border border-border/60 rounded-xl p-6 text-center">
          <h2 className="text-base font-semibold text-foreground mb-2">Couldn&apos;t load</h2>
          <p className="text-sm text-muted-foreground mb-4">{error || 'Unknown error'}</p>
          <Button size="sm" onClick={() => { setLoading(true); load() }}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    // w-full: as a flex child, mx-auto alone would size this to fit-content and
    // the page width would change as results appear/disappear
    <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Price placements, budget recruiting, and track margin from estimate to actuals
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSettingsOpen(true)}
        >
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
          <MarginCalculator
            settings={settings}
            onDealSaved={(deal) => {
              upsertDeal(deal)
              setTab('deals')
            }}
            onSettingsSave={async (next) => {
              const res = await fetch('/api/margin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(next),
              })
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || 'Settings save failed')
              }
              setSettings(next)
            }}
          />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTable
            deals={deals}
            settings={settings}
            onSaved={upsertDeal}
            onDeleted={removeDeal}
          />
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
