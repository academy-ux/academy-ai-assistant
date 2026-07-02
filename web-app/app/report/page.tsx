"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight, Building2, Pencil } from 'lucide-react'
import { logoSourcesFor, fetchLogoMap, teamKey, type LogoConfig } from '@/lib/logo'
import { LogoEditorDialog } from '@/components/report/LogoEditorDialog'

interface Posting {
    id: string
    text: string
    team: string
    location: string
    state: string
    count: number
}

function LogoImg({ team }: { team: string }) {
    const [srcIndex, setSrcIndex] = useState(0)
    const [cfg, setCfg] = useState<LogoConfig | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        let alive = true
        fetchLogoMap().then(map => { if (alive) setCfg(map[teamKey(team)] || null) })
        return () => { alive = false }
    }, [team])

    // Preferred source first (upload / logo.dev / favicon), rest as fallbacks.
    const sources = logoSourcesFor(team, cfg)
    const current = sources[srcIndex]
    useEffect(() => { setSrcIndex(0) }, [cfg])

    return (
        <>
            <div
                className="relative shrink-0 group/logo"
                onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
                onMouseDown={e => e.stopPropagation()}
            >
                {!current || !team ? (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                ) : (
                    <img
                        src={current}
                        alt={`${team} logo`}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-contain bg-white/60"
                        onError={() => setSrcIndex(i => i + 1)}
                    />
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Pencil className="w-3.5 h-3.5 text-white" />
                </div>
            </div>
            <LogoEditorDialog team={team} open={open} onOpenChange={setOpen} cfg={cfg} onSaved={setCfg} />
        </>
    )
}

export default function ReportIndexPage() {
    const [postings, setPostings] = useState<Posting[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchPostings() {
            try {
                const res = await fetch('/api/lever/postings')
                if (res.ok) {
                    const data = await res.json()
                    setPostings(data.postings || [])
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchPostings()
    }, [])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background px-4 md:p-8 py-6 mt-8 md:mt-12">
            <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Active Projects</h1>
                    <p className="text-muted-foreground mt-2 text-sm md:text-base">Select a project to view the candidate report.</p>
                </div>

                {/* Talent Intelligence Report — hidden for now
                <Link
                    href="/report/talent-intelligence"
                    className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card/50 hover:bg-muted/50 transition-colors group"
                >
                    <div className="h-10 w-10 rounded-xl bg-peach/20 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-5 w-5 text-foreground/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-primary transition-colors">Talent Intelligence Report</div>
                        <div className="text-sm text-muted-foreground mt-0.5">Market trends, compensation data, and hiring strategy</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
                */}

                <div className="divide-y divide-border rounded-lg border">
                    {postings.map((posting) => (
                        <Link key={posting.id} href={`/report/${posting.id}`} className="flex items-center justify-between gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 group hover:bg-muted/50 transition-colors">
                            <LogoImg team={posting.team} />
                            <div className="min-w-0 flex-1">
                                <div className="font-medium group-hover:text-primary transition-colors truncate">
                                    {posting.text}
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5">
                                    {posting.team} · {posting.location}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {posting.count > 0 && (
                                    <Badge variant="secondary">
                                        {posting.count} candidates
                                    </Badge>
                                )}
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </Link>
                    ))}

                    {postings.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No active job postings found in Lever.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
