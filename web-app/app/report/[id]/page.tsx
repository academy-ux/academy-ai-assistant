"use client"

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Candidate } from '@/components/candidate/CandidateCard'
import { CandidateTable } from '@/components/candidate/CandidateTable'
import { CandidateDetails } from '@/components/candidate/CandidateDetails'
import { ReportTabs } from '@/components/candidate/ReportTabs'
import { Loader2, AlertCircle, Search, X, ChevronLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
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

    const selectedCandidate = candidates.find(c => c.id === selectedCandidateId)

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Syncing Pipeline</p>
                </div>
            </div>
        )
    }

    const tabs = [
        { value: "presenting", label: "Presenting", count: filteredAndGrouped.presenting.length },
        { value: "interviewing", label: "Client Interview", count: filteredAndGrouped.interviewing.length },
        { value: "portfolio", label: "Portfolio Interview", count: filteredAndGrouped.portfolio.length },
        { value: "applied", label: "Sourced", count: filteredAndGrouped.applied.length },
        { value: "rejected", label: "Archived", count: filteredAndGrouped.rejected.length },
        { value: "all", label: "Applied", count: filteredAndGrouped.all.length },
    ]

    const currentCandidates = filteredAndGrouped[activeTab as keyof typeof filteredAndGrouped] || []

    return (
        <div className="min-h-screen bg-background">
            {/* Ultra Minimal Sticky Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/10">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => router.back()}
                                className="text-muted-foreground/40 hover:text-foreground transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/40 mb-1">Lever Pipeline</span>
                                <h1 className="text-xl font-bold tracking-tight text-foreground">{projectTitle}</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
                                <Input
                                    placeholder="Filter candidates..."
                                    className="pl-10 h-10 w-64 bg-input border-transparent rounded-full focus:bg-background focus:shadow-sm focus:border-primary/20 text-xs transition-all placeholder:text-muted-foreground/30"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <ReportTabs
                        defaultValue="presenting"
                        options={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>
            </div>

            <main className="max-w-[1200px] mx-auto px-6 mt-12 pb-32">
                <div className="animate-in fade-in duration-700">
                    <CandidateTable
                        candidates={currentCandidates}
                        onSelect={(c) => setSelectedCandidateId(c.id)}
                        selectedId={selectedCandidateId || undefined}
                        stages={stages}
                        onRefresh={() => fetchData(true)}
                    />
                </div>
            </main>

            <Sheet open={!!selectedCandidateId} onOpenChange={(open) => !open && setSelectedCandidateId(null)}>
                <SheetContent className="w-full sm:max-w-md lg:max-w-xl overflow-y-auto border-l border-border/10 shadow-none backdrop-blur-3xl bg-background/95 p-0">
                    <div className="h-full flex flex-col">
                        <div className="p-12 pb-6 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Profile Overview</span>
                        </div>
                        <div className="px-12 pb-20 flex-1">
                            {selectedCandidate && (
                                <CandidateDetails
                                    candidate={selectedCandidate}
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
