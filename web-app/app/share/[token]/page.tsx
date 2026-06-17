"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Candidate } from '@/components/candidate/CandidateCard'
import { CandidateTable } from '@/components/candidate/CandidateTable'
import { SharedCandidateDetails } from '@/components/candidate/SharedCandidateDetails'
import { ClientLogo } from '@/components/candidate/ClientLogo'
import { ReportTabs } from '@/components/candidate/ReportTabs'
import { Search, X, Users, AlertCircle, Lock, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"

export default function SharedReportPage() {
    const params = useParams()
    const token = params.token as string

    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [reachedCI, setReachedCI] = useState(0)
    const [team, setTeam] = useState("")
    const [stages, setStages] = useState<{ id: string, text: string }[]>([])
    const [projectTitle, setProjectTitle] = useState("Loading...")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("presenting")
    const [searchQuery, setSearchQuery] = useState("")
    const [searchFocused, setSearchFocused] = useState(false)
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

    // Email gate (soft access control)
    const [needsEmail, setNeedsEmail] = useState(false)
    const [gateEmail, setGateEmail] = useState("")
    const [gateSubmitting, setGateSubmitting] = useState(false)
    const [gateError, setGateError] = useState<string | null>(null)

    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        if (!token) return

        try {
            if (!opts?.silent) setLoading(true)

            const res = await fetch(`/api/share/${token}/candidates`)
            if (res.status === 401) {
                // Restricted share — prompt for an authorized email instead of erroring.
                const data = await res.json().catch(() => ({}))
                if (data.postingTitle) setProjectTitle(data.postingTitle)
                setNeedsEmail(true)
                return
            }
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'This share link is not valid')
            }

            const data = await res.json()
            setNeedsEmail(false)
            setCandidates(data.candidates || [])
            setReachedCI(data.reachedClientInterview || 0)
            if (data.team) setTeam(data.team)
            if (data.postingTitle) {
                setProjectTitle(data.postingTitle)
            } else if (data.candidates?.length > 0) {
                setProjectTitle(data.candidates[0].position)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load report')
        } finally {
            if (!opts?.silent) setLoading(false)
        }
    }, [token])

    const submitEmail = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (gateSubmitting) return
        setGateSubmitting(true)
        setGateError(null)
        try {
            const res = await fetch(`/api/share/${token}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: gateEmail.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Unable to verify this email')
            // Access granted — load the report (and stages).
            setNeedsEmail(false)
            await Promise.all([fetchData(), fetchStages()])
        } catch (err: any) {
            setGateError(err.message || 'Unable to verify this email')
        } finally {
            setGateSubmitting(false)
        }
    }, [token, gateEmail, gateSubmitting])

    const fetchStages = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`/api/share/${token}/stages`)
            if (res.ok) {
                const data = await res.json()
                setStages(data.stages || [])
            }
        } catch (e) {
            console.error("Failed to fetch stages", e)
        }
    }, [token])

    useEffect(() => {
        fetchData()
        fetchStages()
    }, [fetchData, fetchStages])

    // Once candidates are visible, make sure experience is computed (and cached)
    // for the advanced-stage candidates, then silently refresh to show the numbers.
    const experienceTriggeredRef = useRef(false)
    useEffect(() => {
        if (needsEmail || candidates.length === 0 || experienceTriggeredRef.current) return
        experienceTriggeredRef.current = true
        ;(async () => {
            try {
                const res = await fetch(`/api/share/${token}/experience`, { method: 'POST' })
                if (res.ok) {
                    const data = await res.json()
                    if (data.analyzed > 0) fetchData({ silent: true })
                }
            } catch { /* best-effort */ }
        })()
    }, [needsEmail, candidates.length, token, fetchData])

    // Patch a single candidate's decision locally so the table badge updates
    // without re-fetching the whole pipeline from Lever. Accepting also advances
    // the candidate to Client Interview in Lever, so re-pull to reflect the move.
    const handleDecisionChange = useCallback((candidateId: string, decision: 'accepted' | 'rejected' | null) => {
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, clientDecision: decision } : c))
        if (decision === 'accepted') {
            setTimeout(() => fetchData({ silent: true }), 1200)
        }
    }, [fetchData])

    // High-level funnel stats (computed across the full pipeline, ignoring search).
    const stats = useMemo(() => {
        const total = candidates.length
        let presenting = 0
        let clientInterview = 0
        candidates.forEach(c => {
            if (c.archivedAt) return
            const stage = c.stage.toLowerCase()
            if (stage === 'client interview') clientInterview++
            else if (stage.includes('present') || stage.includes('client') || stage.includes('offer')) presenting++
        })
        const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
        // "Ever reached" Client Interview comes from the durable server count and
        // includes candidates later archived after interviewing.
        const everClientInterview = Math.max(reachedCI, clientInterview)
        return {
            total,
            presenting,
            clientInterview: everClientInterview,
            pctPresenting: pct(presenting),
            pctClientInterview: pct(everClientInterview),
        }
    }, [candidates, reachedCI])

    const filteredAndGrouped = useMemo(() => {
        const searched = candidates.filter(c => {
            if (!searchQuery) return true
            const q = searchQuery.toLowerCase()
            return (
                c.name.toLowerCase().includes(q) ||
                c.headline.toLowerCase().includes(q) ||
                (typeof c.location === 'string' && c.location.toLowerCase().includes(q))
            )
        })

        const groups = {
            presenting: [] as Candidate[],
            interviewing: [] as Candidate[],
            portfolio: [] as Candidate[],
            applied: [] as Candidate[],
            rejected: [] as Candidate[],
            all: searched
        }

        searched.forEach(c => {
            const stage = c.stage.toLowerCase()

            if (c.archivedAt) {
                groups.rejected.push(c)
                return
            }

            if (stage === 'client interview') {
                groups.interviewing.push(c)
            }
            else if (stage === 'portfolio interview') {
                groups.portfolio.push(c)
            }
            else if (stage.includes('present') || stage.includes('client') || stage.includes('offer')) {
                groups.presenting.push(c)
            }
            else {
                groups.applied.push(c)
            }
        })

        return groups
    }, [candidates, searchQuery])

    if (needsEmail) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-6">
                <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-sm"
                >
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-peach/40 to-primary/20 flex items-center justify-center mb-4">
                            <Lock className="h-5 w-5 text-foreground/50" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-foreground">
                            {projectTitle !== 'Loading...' ? projectTitle : 'Private Report'}
                        </h1>
                        <p className="text-xs text-muted-foreground/60 mt-1.5 leading-relaxed max-w-[280px]">
                            This report is private. Enter the email address it was shared with to continue.
                        </p>
                    </div>

                    <form onSubmit={submitEmail} className="space-y-3">
                        <Input
                            type="email"
                            required
                            autoFocus
                            placeholder="you@company.com"
                            value={gateEmail}
                            onChange={(e) => { setGateEmail(e.target.value); setGateError(null) }}
                            className="h-11 bg-muted/30 border-border/30 rounded-xl text-sm text-center font-medium focus:bg-card focus:border-border/50"
                        />
                        {gateError && (
                            <p className="text-[11px] text-destructive/70 text-center font-medium">{gateError}</p>
                        )}
                        <button
                            type="submit"
                            disabled={gateSubmitting || !gateEmail.trim()}
                            className="w-full h-11 rounded-xl bg-foreground text-background text-xs font-bold tracking-wide hover:bg-foreground/90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {gateSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            View Report
                        </button>
                    </form>
                </motion.div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 text-center px-6"
                >
                    <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-destructive/60" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Link Unavailable</h2>
                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{error}</p>
                    </div>
                </motion.div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-5"
                >
                    <div className="relative">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-peach/40 to-primary/20 flex items-center justify-center">
                            <Users className="h-4 w-4 text-foreground/40" />
                        </div>
                        <div className="absolute inset-0 h-10 w-10 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground/60">Loading report...</p>
                </motion.div>
            </div>
        )
    }

    const tabs = [
        { value: "presenting", label: "Presenting", count: filteredAndGrouped.presenting.length },
        { value: "interviewing", label: "Client Interview", count: filteredAndGrouped.interviewing.length },
        { value: "portfolio", label: "Portfolio Interview", count: filteredAndGrouped.portfolio.length },
        { value: "applied", label: "Sourced", count: filteredAndGrouped.applied.length },
        { value: "rejected", label: "Archived", count: filteredAndGrouped.rejected.length },
        { value: "all", label: "All Applied", count: filteredAndGrouped.all.length },
    ]

    const currentCandidates = filteredAndGrouped[activeTab as keyof typeof filteredAndGrouped] || []
    const selectedCandidate = candidates.find(c => c.id === selectedCandidateId)

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
                <div className="max-w-[1200px] mx-auto px-6">
                    {/* Title area */}
                    <div className="pt-5 pb-4">
                        <div className="flex items-center gap-3">
                            {team && <ClientLogo team={team} size={40} />}
                            <div className="min-w-0">
                                <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight truncate">
                                    {projectTitle}
                                </h1>
                                <p className="text-xs text-muted-foreground/50 font-medium mt-0.5 tabular-nums">
                                    {team ? `${team} · ` : ''}{candidates.length} candidates in pipeline
                                </p>
                            </div>
                        </div>

                        {/* Funnel stats */}
                        {stats.total > 0 && (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                    { label: "Total Applied", value: stats.total.toString() },
                                    { label: "Presenting", value: stats.presenting.toString(), sub: `${stats.pctPresenting}% of applied` },
                                    { label: "Client Interview", value: stats.clientInterview.toString(), sub: `reached, incl. past` },
                                    { label: "Presentation Conversion", value: `${stats.pctClientInterview}%`, sub: `applied → client interview` },
                                ].map(stat => (
                                    <div key={stat.label} className="rounded-xl bg-muted/20 px-3.5 py-3">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">{stat.label}</p>
                                        <p className="text-xl font-bold tracking-tight text-foreground tabular-nums mt-1">{stat.value}</p>
                                        {stat.sub && <p className="text-[10px] text-muted-foreground/40 font-medium mt-0.5">{stat.sub}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabs + search.
                        Desktop: tabs scroll on the left, search fixed on the right.
                        Mobile: search always visible on top, tabs scroll below it. */}
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-1">
                        {/* Search */}
                        <div className="order-1 md:order-2 md:shrink-0 w-full md:w-60 pb-2 md:pb-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                                <Input
                                    placeholder="Search candidates..."
                                    className="pl-9 h-9 w-full bg-muted/30 border-transparent rounded-xl text-xs font-medium placeholder:text-muted-foreground/30 focus:bg-card focus:border-border/40 focus:shadow-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <AnimatePresence>
                                    {searchQuery && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all"
                                        >
                                            <X className="h-3 w-3" />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="order-2 md:order-1 min-w-0 md:flex-1">
                            <ReportTabs
                                defaultValue="presenting"
                                options={tabs}
                                activeTab={activeTab}
                                onChange={setActiveTab}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-[1200px] mx-auto px-6 py-8 pb-32">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <CandidateTable
                            candidates={currentCandidates}
                            onSelect={(c) => setSelectedCandidateId(c.id)}
                            selectedId={selectedCandidateId || undefined}
                            stages={stages}
                            readOnly={true}
                        />
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Detail Sheet */}
            <Sheet open={!!selectedCandidateId} onOpenChange={(open) => !open && setSelectedCandidateId(null)}>
                <SheetContent className="w-full sm:max-w-lg lg:max-w-xl overflow-y-auto border-l border-border/20 bg-background p-0">
                    <div className="h-full flex flex-col">
                        <div className="px-8 pt-8 pb-4 border-b border-border/10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Candidate Profile</span>
                        </div>
                        <div className="px-8 py-6 flex-1 overflow-y-auto">
                            {selectedCandidate && (
                                <SharedCandidateDetails
                                    candidate={selectedCandidate}
                                    token={token}
                                    onDecisionChange={handleDecisionChange}
                                />
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
