"use client"

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Candidate } from '@/components/candidate/CandidateCard'
import { CandidateTable } from '@/components/candidate/CandidateTable'
import { CandidateDetails } from '@/components/candidate/CandidateDetails'
import { ReportTabs } from '@/components/candidate/ReportTabs'
import { Search, X, ChevronLeft, Users, FileText, Loader2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"

export default function CandidateReportPage() {
    const params = useParams()
    const router = useRouter()
    const postingId = params.id as string

    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [stages, setStages] = useState<{ id: string, text: string }[]>([])
    const [projectTitle, setProjectTitle] = useState("Loading...")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState("presenting")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
    const [searchFocused, setSearchFocused] = useState(false)
    const [experienceMap, setExperienceMap] = useState<Record<string, { relevantYears: number; totalYears: number; summary: string } | null>>({})
    const [experienceLoading, setExperienceLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [exportResult, setExportResult] = useState<{ url: string; stats: any } | null>(null)

    const fetchStages = useCallback(async () => {
        try {
            const res = await fetch('/api/lever/stages')
            if (res.ok) {
                const data = await res.json()
                setStages(data.stages || [])
            }
        } catch (e) {
            console.error("Failed to fetch stages", e)
        }
    }, [])

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!postingId) return

        try {
            if (!isRefresh) setLoading(true)

            const res = await fetch(`/api/lever/candidates?postingId=${postingId}`)
            if (!res.ok) throw new Error('Failed to fetch candidates')
            const data = await res.json()
            const fetchedCandidates = data.candidates || []
            setCandidates(fetchedCandidates)

            if (postingId === '__uncategorized__') {
                setProjectTitle("Uncategorized")
            } else if (fetchedCandidates.length > 0 && fetchedCandidates[0].position !== 'Uncategorized') {
                setProjectTitle(fetchedCandidates[0].position)
            } else {
                const pRes = await fetch('/api/lever/postings')
                if (pRes.ok) {
                    const pData = await pRes.json()
                    const current = pData.postings?.find((p: any) => p.id === postingId)
                    if (current) setProjectTitle(current.text)
                }
            }
        } catch (err) {
            console.error(err)
            if (!isRefresh) setError('Failed to load project data. Please try again.')
        } finally {
            if (!isRefresh) setLoading(false)
        }
    }, [postingId])

    const fetchExperience = useCallback(async (candidateList: Candidate[]) => {
        if (!candidateList.length || !postingId) return
        setExperienceLoading(true)
        try {
            const res = await fetch('/api/lever/candidates/batch-experience', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: candidateList.map(c => ({ id: c.id, email: c.email || null })),
                    postingId
                })
            })
            if (res.ok) {
                const data = await res.json()
                setExperienceMap(data.experience || {})
            }
        } catch (e) {
            console.error("Failed to fetch experience data", e)
        } finally {
            setExperienceLoading(false)
        }
    }, [postingId])

    const handleExport = useCallback(async () => {
        if (exporting) return
        setExporting(true)
        setExportResult(null)
        try {
            const res = await fetch(`/api/report/${postingId}/export-doc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectTitle }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Export failed')
            setExportResult({ url: data.url, stats: data.stats })
            window.open(data.url, '_blank')
        } catch (err) {
            console.error('Export failed:', err)
            alert(err instanceof Error ? err.message : 'Failed to export report')
        } finally {
            setExporting(false)
        }
    }, [exporting, postingId, projectTitle])

    useEffect(() => {
        fetchData()
        fetchStages()
    }, [fetchData, fetchStages])

    // Fetch experience after candidates are loaded
    useEffect(() => {
        if (candidates.length > 0) {
            fetchExperience(candidates)
        }
    }, [candidates, fetchExperience])

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

    const selectedCandidate = candidates.find(c => c.id === selectedCandidateId)

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
                    <p className="text-xs font-medium text-muted-foreground/60">Loading pipeline...</p>
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
                    {/* Utility bar — back nav + search */}
                    <div className="flex items-center justify-between pt-5 pb-1">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 -ml-1 px-2 py-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all group"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                            <span className="text-[11px] font-medium">Back</span>
                        </button>

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

                    {/* Title area — generous breathing room */}
                    <div className="pt-3 pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
                                    {projectTitle}
                                </h1>
                                <p className="text-xs text-muted-foreground/50 font-medium mt-1.5 tabular-nums">
                                    {candidates.length} candidates in pipeline
                                </p>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={exporting || candidates.length === 0}
                                className={cn(
                                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all",
                                    exporting
                                        ? "bg-muted/50 text-muted-foreground/50 cursor-wait"
                                        : "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.97]"
                                )}
                            >
                                {exporting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Generating report...</span>
                                    </>
                                ) : exportResult ? (
                                    <>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>Open in Docs</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText className="h-3.5 w-3.5" />
                                        <span>Export to Google Doc</span>
                                    </>
                                )}
                            </button>
                        </div>
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
                            onSelect={(c) => setSelectedCandidateId(c.id)}
                            selectedId={selectedCandidateId || undefined}
                            stages={stages}
                            onRefresh={() => fetchData(true)}
                            experienceMap={experienceMap}
                            experienceLoading={experienceLoading}
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
                                <CandidateDetails
                                    candidate={selectedCandidate}
                                    postingId={postingId}
                                    onRefresh={() => fetchData(true)}
                                />
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
