"use client"

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight, Building2, Pencil, Check, X, Upload, Trash2 } from 'lucide-react'
import { logoSourcesFor, fetchLogoMap, teamKey, type LogoConfig } from '@/lib/logo'

interface Posting {
    id: string
    text: string
    team: string
    location: string
    state: string
    count: number
}

function teamToDomain(team: string): string {
    const name = team.toLowerCase().trim()

    // Explicit overrides for known multi-word domains
    const overrides: Record<string, string> = {
        'dex screener': 'dexscreener.com',
    }
    if (overrides[name]) return overrides[name]

    // Academy roles → academyux.com
    if (name.includes('academy')) return 'academyux.com'

    // Use the first word as the domain (e.g. "Google DeepMind" → "google.com")
    const firstWord = name.split(/\s+/)[0].replace(/[^a-z0-9]/g, '')
    return firstWord + '.com'
}

function getLogoOverrides(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem('logo-overrides') || '{}')
    } catch { return {} }
}

function resolvedDomain(team: string): string {
    const override = getLogoOverrides()[team.toLowerCase().trim()]
    return override || teamToDomain(team)
}

function LogoImg({ team }: { team: string }) {
    const [srcIndex, setSrcIndex] = useState(0)
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [cfg, setCfg] = useState<LogoConfig | null>(null)
    const [busy, setBusy] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        let alive = true
        fetchLogoMap().then(map => { if (alive) setCfg(map[teamKey(team)] || null) })
        return () => { alive = false }
    }, [team])

    // Uploaded logo first, then crisp brand logo, then website favicon.
    const sources = logoSourcesFor(team, cfg)
    const current = sources[srcIndex]
    useEffect(() => { setSrcIndex(0) }, [cfg])

    function startEditing(e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        setDraft(cfg?.domain || resolvedDomain(team))
        setEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    async function save(e: React.MouseEvent | React.FormEvent) {
        e.preventDefault()
        e.stopPropagation()
        const cleaned = draft.trim().toLowerCase()
        if (cleaned) {
            setCfg(c => ({ ...c, domain: cleaned }))
            setSrcIndex(0)
            await fetch('/api/logos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team, domain: cleaned }),
            }).catch(() => {})
            fetchLogoMap(true)
        }
        setEditing(false)
    }

    async function uploadFile(file: File) {
        setBusy(true)
        try {
            const form = new FormData()
            form.set('team', team)
            form.set('file', file)
            const res = await fetch('/api/logos', { method: 'POST', body: form })
            const body = await res.json()
            if (res.ok && body.logoUrl) {
                setCfg(c => ({ ...c, logoUrl: body.logoUrl }))
                setSrcIndex(0)
                fetchLogoMap(true)
                setEditing(false)
            } else {
                alert(body.error || 'Upload failed')
            }
        } catch {
            alert('Upload failed')
        } finally {
            setBusy(false)
        }
    }

    async function removeUpload(e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        setCfg(c => ({ ...c, logoUrl: null }))
        setSrcIndex(0)
        await fetch('/api/logos', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team }),
        }).catch(() => {})
        fetchLogoMap(true)
    }

    function cancel(e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        setEditing(false)
    }

    if (editing) {
        return (
            <form
                onSubmit={save}
                onClick={e => { e.preventDefault(); e.stopPropagation() }}
                onMouseDown={e => e.stopPropagation()}
                className="flex items-center gap-1 shrink-0"
            >
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    onMouseDown={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Escape') cancel(e as any) }}
                    placeholder="company.com"
                    className="w-28 h-8 px-2 text-xs border rounded-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="submit" className="p-1 hover:bg-muted rounded" onClick={save} title="Save domain">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                </button>
                <button
                    type="button"
                    className="p-1 hover:bg-muted rounded disabled:opacity-50"
                    disabled={busy}
                    title="Upload a custom logo (PNG, JPG, SVG, WebP)"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click() }}
                >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : <Upload className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {cfg?.logoUrl && (
                    <button type="button" className="p-1 hover:bg-muted rounded" title="Remove uploaded logo" onClick={removeUpload}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                    </button>
                )}
                <button type="button" className="p-1 hover:bg-muted rounded" onClick={cancel} title="Close">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onClick={e => e.stopPropagation()}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
                />
            </form>
        )
    }

    return (
        <div className="relative shrink-0 group/logo" onClick={startEditing}>
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
