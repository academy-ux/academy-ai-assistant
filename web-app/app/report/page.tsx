"use client"

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight, Building2, Pencil, Check, X } from 'lucide-react'

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

function saveLogoOverride(team: string, domain: string) {
    const overrides = getLogoOverrides()
    overrides[team.toLowerCase().trim()] = domain
    localStorage.setItem('logo-overrides', JSON.stringify(overrides))
}

function resolvedDomain(team: string): string {
    const override = getLogoOverrides()[team.toLowerCase().trim()]
    return override || teamToDomain(team)
}

function LogoImg({ team }: { team: string }) {
    const [errored, setErrored] = useState(false)
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [domain, setDomain] = useState(() => resolvedDomain(team))
    const inputRef = useRef<HTMLInputElement>(null)

    const src = `https://img.logo.dev/${domain}?token=pk_MYqNmj5NQQSYUFupTGVUjQ&size=64&format=png`

    function startEditing(e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        setDraft(domain)
        setEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    function save(e: React.MouseEvent | React.FormEvent) {
        e.preventDefault()
        e.stopPropagation()
        const cleaned = draft.trim().toLowerCase()
        if (cleaned) {
            saveLogoOverride(team, cleaned)
            setDomain(cleaned)
            setErrored(false)
        }
        setEditing(false)
    }

    function cancel(e: React.MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        setEditing(false)
    }

    if (editing) {
        return (
            <form onSubmit={save} onClick={e => e.preventDefault()} className="flex items-center gap-1 shrink-0">
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Escape') cancel(e as any) }}
                    placeholder="company.com"
                    className="w-28 h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="submit" className="p-1 hover:bg-muted rounded" onClick={save}>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                </button>
                <button type="button" className="p-1 hover:bg-muted rounded" onClick={cancel}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
            </form>
        )
    }

    return (
        <div className="relative shrink-0 group/logo" onClick={startEditing}>
            {errored || !team ? (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
            ) : (
                <Image
                    src={src}
                    alt={`${team} logo`}
                    width={40}
                    height={40}
                    className="rounded-lg"
                    onError={() => setErrored(true)}
                    unoptimized
                />
            )}
            <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
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
        <div className="min-h-screen bg-background p-8 mt-12">
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Active Projects</h1>
                    <p className="text-muted-foreground mt-2">Select a project to view the candidate report.</p>
                </div>

                <div className="divide-y divide-border rounded-lg border">
                    {postings.map((posting) => (
                        <Link key={posting.id} href={`/report/${posting.id}`} className="flex items-center justify-between gap-4 px-5 py-4 group hover:bg-muted/50 transition-colors">
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
