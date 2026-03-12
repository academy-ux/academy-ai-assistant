"use client"

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Candidate } from '@/components/candidate/CandidateCard'
import { CandidateTable } from '@/components/candidate/CandidateTable'
import { ReportTabs } from '@/components/candidate/ReportTabs'
import { Search, X, Users, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'

export default function SharedReportPage() {
    const params = useParams()
    const token = params.token as string

    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [stages, setStages] = useState<{ id: string, text: string }[]>([])
    const [projectTitle, setProjectTitle] = useState("Loading...")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("presenting")
    const [searchQuery, setSearchQuery] = useState("")
    const [searchFocused, setSearchFocused] = useState(false)

    const fetchData = useCallback(async () => {
        if (!token) return

        try {
            setLoading(true)

            const res = await fetch(`/api/share/${token}/candidates`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'This share link is not valid')
            }

            const data = await res.json()
            setCandidates(data.candidates || [])
            if (data.postingTitle) {
                setProjectTitle(data.postingTitle)
            } else if (data.candidates?.length > 0) {
                setProjectTitle(data.candidates[0].position)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load report')
        } finally {
            setLoading(false)
        }
    }, [token])

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

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30">
                <div className="max-w-[1200px] mx-auto px-6">
                    {/* Utility bar — search only */}
                    <div className="flex items-center justify-end pt-5 pb-1">
                        <div className={cn(
                            "relative transition-all duration-300",
                            searchFocused ? "w-80" : "w-56"
                        )}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                            <Input
                                placeholder="Search candidates..."
                                className="pl-9 h-9 bg-muted/30 border-transparent rounded-xl text-xs font-medium transition-all placeholder:text-muted-foreground/30 focus:bg-card focus:border-border/40 focus:shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
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

                    {/* Title area */}
                    <div className="pt-3 pb-4">
                        <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
                            {projectTitle}
                        </h1>
                        <p className="text-xs text-muted-foreground/50 font-medium mt-1.5 tabular-nums">
                            {candidates.length} candidates in pipeline
                        </p>
                    </div>

                    {/* Tabs */}
                    <ReportTabs
                        defaultValue="presenting"
                        options={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
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
                            onSelect={() => {}}
                            stages={stages}
                            readOnly={true}
                        />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    )
}
