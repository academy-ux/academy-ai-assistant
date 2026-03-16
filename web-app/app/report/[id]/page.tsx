"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Candidate } from '@/components/candidate/CandidateCard'
import { CandidateTable } from '@/components/candidate/CandidateTable'
import { CandidateDetails } from '@/components/candidate/CandidateDetails'
import { ReportTabs } from '@/components/candidate/ReportTabs'
import { Search, X, ChevronLeft, Users, FileText, Loader2, ExternalLink, Share2, Check, RefreshCw, FolderOpen, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"

// ─── Export Progress Overlay ─────────────────────────────────────

const EXPORT_STEPS = [
    { id: 'fetch', label: 'Fetching candidates' },
    { id: 'pitch', label: 'Generating pitches' },
    { id: 'doc', label: 'Creating document' },
] as const

type ExportStep = typeof EXPORT_STEPS[number]['id']

function ExportOverlay({
    active,
    step,
    syncing,
    result,
    onClose,
    onOpen,
    onOpenFolder,
}: {
    active: boolean
    step: ExportStep
    syncing: boolean
    result: { url: string; folderUrl: string | null; stats: any } | null
    onClose: () => void
    onOpen: () => void
    onOpenFolder: () => void
}) {
    const stepIndex = EXPORT_STEPS.findIndex(s => s.id === step)
    const done = !!result

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                        onClick={done ? onClose : undefined}
                    />

                    {/* Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="relative w-[340px] bg-card rounded-2xl border border-border/40 shadow-xl shadow-black/5 overflow-hidden"
                    >
                        {/* Progress bar at top */}
                        {!done && (
                            <div className="h-[2px] bg-muted/40">
                                <motion.div
                                    className="h-full bg-foreground/70"
                                    initial={{ width: '0%' }}
                                    animate={{
                                        width: step === 'fetch' ? '25%' : step === 'pitch' ? '60%' : '85%'
                                    }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }}
                                />
                            </div>
                        )}

                        <div className="px-7 py-6">
                            <AnimatePresence mode="wait">
                                {!done ? (
                                    /* Progress State */
                                    <motion.div
                                        key="progress"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40 mb-5">
                                            {syncing ? 'Syncing Report' : 'Generating Report'}
                                        </p>

                                        <div className="space-y-3">
                                            {EXPORT_STEPS.map((s, i) => {
                                                const isCurrent = i === stepIndex
                                                const isComplete = i < stepIndex
                                                return (
                                                    <div key={s.id} className="flex items-center gap-3">
                                                        <div className="relative flex items-center justify-center w-5 h-5">
                                                            {isComplete ? (
                                                                <motion.div
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                                                >
                                                                    <Check className="h-3.5 w-3.5 text-foreground/60" />
                                                                </motion.div>
                                                            ) : isCurrent ? (
                                                                <Loader2 className="h-3.5 w-3.5 text-foreground/60 animate-spin" />
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "text-[13px] transition-colors duration-300",
                                                            isCurrent ? "text-foreground font-medium" :
                                                            isComplete ? "text-muted-foreground/50" :
                                                            "text-muted-foreground/30"
                                                        )}>
                                                            {s.label}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                ) : (
                                    /* Success State */
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, delay: 0.1 }}
                                    >
                                        <div className="flex items-center gap-2.5 mb-4">
                                            <div className="w-7 h-7 rounded-xl bg-foreground/[0.06] flex items-center justify-center">
                                                <Check className="h-3.5 w-3.5 text-foreground/70" />
                                            </div>
                                            <p className="text-[13px] font-semibold text-foreground">
                                                {syncing ? 'Report synced' : 'Report created'}
                                            </p>
                                        </div>

                                        {/* Stats */}
                                        {result.stats && (
                                            <div className="flex gap-4 mb-5 py-3 px-4 rounded-xl bg-muted/20">
                                                {[
                                                    { n: result.stats.presenting, l: 'presenting' },
                                                    { n: result.stats.interviewed, l: 'interviewed' },
                                                    { n: result.stats.applied, l: 'applied' },
                                                    { n: result.stats.pitchesGenerated, l: 'pitches' },
                                                ].filter(s => s.n > 0).map(s => (
                                                    <div key={s.l} className="text-center">
                                                        <p className="text-[15px] font-semibold text-foreground tabular-nums">{s.n}</p>
                                                        <p className="text-[9px] text-muted-foreground/50 font-medium">{s.l}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={onOpen}
                                                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors active:scale-[0.98]"
                                            >
                                                <span>Open in Docs</span>
                                                <ArrowUpRight className="h-3 w-3" />
                                            </button>
                                            {result.folderUrl && (
                                                <button
                                                    onClick={onOpenFolder}
                                                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors active:scale-[0.98]"
                                                    title="Open in Google Drive"
                                                >
                                                    <FolderOpen className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={onClose}
                                                className="flex items-center justify-center w-9 h-9 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors active:scale-[0.98]"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

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
    const experienceFetchedRef = useRef(false)
    const pitchFetchedRef = useRef(false)
    const [exporting, setExporting] = useState(false)
    const [exportResult, setExportResult] = useState<{ url: string; folderUrl: string | null; synced: boolean; stats: any } | null>(null)
    const [exportOverlayOpen, setExportOverlayOpen] = useState(false)
    const [exportStep, setExportStep] = useState<ExportStep>('fetch')
    const [exportOverlayResult, setExportOverlayResult] = useState<{ url: string; folderUrl: string | null; stats: any } | null>(null)
    const [shareLoading, setShareLoading] = useState(false)
    const [shareCopied, setShareCopied] = useState(false)

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
        if (!candidateList.length || !postingId || experienceFetchedRef.current) return

        // Only analyze candidates in advanced stages (not sourced/archived)
        const qualifyingCandidates = candidateList.filter(c => {
            if (c.archivedAt) return false
            const stage = c.stage.toLowerCase()
            return stage === 'client interview'
                || stage === 'portfolio interview'
                || stage.includes('present')
                || stage.includes('client')
                || stage.includes('offer')
        })

        if (!qualifyingCandidates.length) return

        experienceFetchedRef.current = true
        setExperienceLoading(true)
        try {
            const res = await fetch('/api/lever/candidates/batch-experience', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: qualifyingCandidates.map(c => ({ id: c.id, email: c.email || null })),
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

    // Background: auto-generate pitches for presenting-stage candidates
    const generatePitches = useCallback(async (candidateList: Candidate[]) => {
        if (!candidateList.length || !postingId || pitchFetchedRef.current) return

        const presentingCandidates = candidateList.filter(c => {
            if (c.archivedAt || !c.email) return false
            const stage = c.stage.toLowerCase()
            return stage.includes('present') || stage.includes('offer')
        })

        if (!presentingCandidates.length) return

        pitchFetchedRef.current = true
        try {
            await fetch('/api/candidates/batch-pitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: presentingCandidates.map(c => ({ email: c.email, name: c.name })),
                    postingId
                })
            })
        } catch (e) {
            console.error("Background pitch generation failed", e)
        }
    }, [postingId])

    const handleExport = useCallback(async () => {
        if (exporting) return
        const isSync = !!exportResult
        setExporting(true)
        setExportOverlayOpen(true)
        setExportOverlayResult(null)
        setExportStep('fetch')

        // Simulate step progression (the API does all 3 steps in one call)
        const pitchTimer = setTimeout(() => setExportStep('pitch'), 1500)
        const docTimer = setTimeout(() => setExportStep('doc'), 6000)

        try {
            const res = await fetch(`/api/report/${postingId}/export-doc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectTitle }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Export failed')

            clearTimeout(pitchTimer)
            clearTimeout(docTimer)

            setExportResult({ url: data.url, folderUrl: data.folderUrl, synced: data.synced, stats: data.stats })
            setExportOverlayResult({ url: data.url, folderUrl: data.folderUrl, stats: data.stats })
        } catch (err) {
            clearTimeout(pitchTimer)
            clearTimeout(docTimer)
            console.error('Export failed:', err)
            toast.error(err instanceof Error ? err.message : 'Failed to export report')
            setExportOverlayOpen(false)
        } finally {
            setExporting(false)
        }
    }, [exporting, exportResult, postingId, projectTitle])

    const handleShare = useCallback(async () => {
        if (shareLoading) return
        setShareLoading(true)
        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postingId, postingTitle: projectTitle })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create share link')
            if (data.url) {
                await navigator.clipboard.writeText(data.url)
                setShareCopied(true)
                toast.success("Share link copied to clipboard")
                setTimeout(() => setShareCopied(false), 2000)
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create share link")
        } finally {
            setShareLoading(false)
        }
    }, [shareLoading, postingId, projectTitle])

    // Check if a doc already exists for this posting
    const checkExistingDoc = useCallback(async () => {
        if (!postingId) return
        try {
            const res = await fetch(`/api/report/${postingId}/export-doc`)
            if (res.ok) {
                const data = await res.json()
                if (data.exists) {
                    setExportResult({
                        url: data.url,
                        folderUrl: data.folderUrl,
                        synced: true,
                        stats: null,
                    })
                }
            }
        } catch (_) {}
    }, [postingId])

    useEffect(() => {
        fetchData()
        fetchStages()
        checkExistingDoc()
    }, [fetchData, fetchStages, checkExistingDoc])

    // Fetch experience + generate pitches after candidates are loaded
    useEffect(() => {
        if (candidates.length > 0) {
            fetchExperience(candidates)
            generatePitches(candidates)
        }
    }, [candidates, fetchExperience, generatePitches])

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
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
                <div className="max-w-[1200px] mx-auto px-4 md:px-6">
                    {/* Back nav */}
                    <div className="pt-4 md:pt-5 pb-1">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 -ml-1 px-2 py-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-colors duration-200 group"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                            <span className="text-[11px] font-medium">Back</span>
                        </button>
                    </div>

                    {/* Title area */}
                    <div className="pt-2 md:pt-3 pb-3 md:pb-4">
                        <h1 className="text-lg md:text-[22px] font-bold tracking-tight text-foreground leading-tight">
                            {projectTitle}
                        </h1>
                        <p className="text-xs text-muted-foreground/50 font-medium mt-1 md:mt-1.5 tabular-nums">
                            {candidates.length} candidates in pipeline
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="-mb-px">
                        <ReportTabs
                            defaultValue="presenting"
                            options={tabs}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8 pb-32">
                {/* Search + Actions toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 mb-6">
                    <div className={cn(
                        "relative transition-[width] duration-300 ease-smooth w-full sm:w-auto",
                        searchFocused ? "sm:w-72" : "sm:w-56"
                    )}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                        <Input
                            placeholder="Search candidates..."
                            className="pl-9 h-9 bg-muted/30 border-transparent rounded-xl text-xs font-medium transition-[background-color,border-color,box-shadow] duration-200 ease-smooth placeholder:text-muted-foreground/30 focus:bg-card focus:border-border/40 focus:shadow-sm"
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
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-colors duration-150"
                                >
                                    <X className="h-3 w-3" />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                        <button
                            onClick={handleShare}
                            disabled={shareLoading}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-[color,background-color,transform] duration-200 ease-smooth whitespace-nowrap border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 active:scale-[0.97]"
                        >
                            {shareLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : shareCopied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <Share2 className="h-3.5 w-3.5" />
                            )}
                            <span>{shareCopied ? "Copied!" : "Share"}</span>
                        </button>

                        {exportResult && (
                            <>
                                <button
                                    onClick={() => window.open(exportResult.folderUrl || exportResult.url, '_blank')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-[color,background-color,transform] duration-200 ease-smooth whitespace-nowrap border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 active:scale-[0.97]"
                                    title="Open in Google Drive"
                                >
                                    <FolderOpen className="h-3.5 w-3.5" />
                                    <span>Drive</span>
                                </button>
                                <button
                                    onClick={() => window.open(exportResult.url, '_blank')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-[color,background-color,transform] duration-200 ease-smooth whitespace-nowrap border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 active:scale-[0.97]"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Open</span>
                                </button>
                            </>
                        )}

                        <button
                            onClick={handleExport}
                            disabled={exporting || candidates.length === 0}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-[color,background-color,transform] duration-200 ease-smooth whitespace-nowrap bg-foreground text-background hover:bg-foreground/90 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
                        >
                            {exportResult ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>Sync Report</span>
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
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                        <div className="px-5 md:px-8 pt-6 md:pt-8 pb-4 border-b border-border/10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Candidate Profile</span>
                        </div>
                        <div className="px-5 md:px-8 py-5 md:py-6 flex-1 overflow-y-auto">
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

            {/* Export Progress Overlay */}
            <ExportOverlay
                active={exportOverlayOpen}
                step={exportStep}
                syncing={!!exportResult?.synced}
                result={exportOverlayResult}
                onClose={() => setExportOverlayOpen(false)}
                onOpen={() => {
                    if (exportOverlayResult?.url) window.open(exportOverlayResult.url, '_blank')
                    setExportOverlayOpen(false)
                }}
                onOpenFolder={() => {
                    if (exportOverlayResult?.folderUrl) window.open(exportOverlayResult.folderUrl, '_blank')
                }}
            />
        </div>
    )
}
