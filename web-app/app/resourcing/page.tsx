'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import ResourcingPlanner, { ScheduleData } from '@/components/resourcing/resourcing-planner'

export default function ResourcingPage() {
  const { data: session, status } = useSession()
  const allowed = status !== 'authenticated' || Boolean((session?.user as any)?.isResourcingAdmin)
  const [data, setData] = useState<ScheduleData | null>(null)
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (refresh = false) => {
    try {
      setError(null)
      const res = await fetch(`/api/resourcing/schedule${refresh ? '?refresh=1' : ''}`)
      const body = await res.json()
      if (!res.ok) {
        setError({ code: body.error, message: body.message || body.error || 'Failed to load schedule' })
        return
      }
      setData(body)
    } catch {
      setError({ message: 'Failed to load schedule' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && allowed) load()
    if (status === 'unauthenticated') setLoading(false)
  }, [status, allowed, load])

  if (status === 'authenticated' && !allowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-md bg-card border border-border/60 rounded-xl p-6 text-center animate-fade-in-up">
          <h2 className="text-base font-semibold text-foreground mb-2">Admins only</h2>
          <p className="text-sm text-muted-foreground">
            The resourcing planner is limited to planner admins. Ask Adam if you need access.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground animate-pulse">Loading schedule from Harvest…</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm text-muted-foreground">Sign in to view the resourcing planner.</div>
      </div>
    )
  }

  if (error) {
    const notConfigured = error.code === 'harvest_not_configured'
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-lg bg-card border border-border/60 rounded-xl p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-foreground mb-2">
            {notConfigured ? 'Connect Harvest to get started' : 'Couldn’t load the schedule'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          {notConfigured && (
            <ol className="text-sm text-muted-foreground list-decimal ml-4 space-y-1 mb-4">
              <li>Create a personal access token at id.getharvest.com → Developers</li>
              <li>Add <code className="text-xs bg-muted px-1 py-0.5 rounded">HARVEST_ACCOUNT_ID</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">HARVEST_ACCESS_TOKEN</code> to <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> (and Vercel)</li>
              <li>Restart the app and reload this page</li>
            </ol>
          )}
          <button
            onClick={() => { setLoading(true); load(true) }}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null
  return <ResourcingPlanner data={data} onResync={() => load(true)} />
}
