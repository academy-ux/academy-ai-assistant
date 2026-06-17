"use client"

import { useState } from 'react'
import { X, Link2, Check, Globe, Lock, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShareReportDialogProps {
    open: boolean
    onClose: () => void
    postingId: string
    postingTitle: string
}

type Mode = 'anyone' | 'restricted'

// Split a raw token into an exact email or a domain rule (mirrors the server's
// parseAllowlist so the preview matches what actually gets stored).
function classify(token: string): { email?: string; domain?: string } | null {
    const t = token.trim().toLowerCase()
    if (!t) return null
    if (t.startsWith('@')) {
        const d = t.slice(1)
        return d.includes('.') ? { domain: d } : null
    }
    if (t.includes('@')) {
        return t.split('@')[1]?.includes('.') ? { email: t } : null
    }
    return t.includes('.') ? { domain: t } : null
}

export function ShareReportDialog({ open, onClose, postingId, postingTitle }: ShareReportDialogProps) {
    const [mode, setMode] = useState<Mode>('anyone')
    const [entries, setEntries] = useState<string[]>([])
    const [draft, setDraft] = useState('')
    const [creating, setCreating] = useState(false)
    const [url, setUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    if (!open) return null

    const addDraft = () => {
        const parts = draft.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
        const valid = parts.filter(p => classify(p))
        const invalid = parts.filter(p => !classify(p))
        if (invalid.length) toast.error(`Skipped invalid entr${invalid.length > 1 ? 'ies' : 'y'}: ${invalid.join(', ')}`)
        if (valid.length) setEntries(prev => Array.from(new Set([...prev, ...valid.map(v => v.toLowerCase())])))
        setDraft('')
    }

    const removeEntry = (e: string) => setEntries(prev => prev.filter(x => x !== e))

    const handleCreate = async () => {
        if (creating) return
        // Fold any text still in the input into the list first.
        let finalEntries = entries
        if (draft.trim()) {
            const parts = draft.split(/[\s,;]+/).map(s => s.trim()).filter(p => classify(p))
            finalEntries = Array.from(new Set([...entries, ...parts]))
            setEntries(finalEntries)
            setDraft('')
        }

        const allowedEmails: string[] = []
        const allowedDomains: string[] = []
        if (mode === 'restricted') {
            for (const e of finalEntries) {
                const c = classify(e)
                if (c?.email) allowedEmails.push(c.email)
                else if (c?.domain) allowedDomains.push(c.domain)
            }
            if (allowedEmails.length === 0 && allowedDomains.length === 0) {
                toast.error('Add at least one email or domain, or choose "Anyone with the link".')
                return
            }
        }

        setCreating(true)
        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postingId, postingTitle, allowedEmails, allowedDomains }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create share link')
            setUrl(data.url)
            await navigator.clipboard.writeText(data.url).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success(data.restricted ? 'Restricted link created & copied' : 'Public link created & copied')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create share link')
        } finally {
            setCreating(false)
        }
    }

    const copyUrl = () => {
        if (!url) return
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border/40 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <Link2 className="h-4 w-4 text-muted-foreground/60" />
                        <h2 className="text-[15px] font-semibold text-foreground">Share report</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <X className="h-4 w-4 text-muted-foreground/60" />
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                    {/* Access mode toggle */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setMode('anyone')}
                            className={cn(
                                "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors",
                                mode === 'anyone' ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/30"
                            )}
                        >
                            <Globe className={cn("h-4 w-4 mt-0.5 shrink-0", mode === 'anyone' ? "text-primary" : "text-muted-foreground/50")} />
                            <div>
                                <p className="text-xs font-semibold text-foreground">Anyone with the link</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">No email required</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setMode('restricted')}
                            className={cn(
                                "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors",
                                mode === 'restricted' ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-muted/30"
                            )}
                        >
                            <Lock className={cn("h-4 w-4 mt-0.5 shrink-0", mode === 'restricted' ? "text-primary" : "text-muted-foreground/50")} />
                            <div>
                                <p className="text-xs font-semibold text-foreground">Only specific people</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">By email or domain</p>
                            </div>
                        </button>
                    </div>

                    {/* Allowlist editor */}
                    {mode === 'restricted' && (
                        <div className="space-y-2.5">
                            <div className="flex gap-2">
                                <input
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraft() } }}
                                    placeholder="sarah@samsara.com  or  @samsara.com"
                                    className="flex-1 h-9 px-3 rounded-xl border border-border/40 bg-muted/20 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/60"
                                />
                                <button onClick={addDraft} className="h-9 px-3 rounded-xl border border-border/40 text-muted-foreground hover:bg-muted/30 transition-colors">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                                Add a full email to allow one person, or <span className="font-semibold">@domain.com</span> to allow everyone at a company.
                            </p>
                            {entries.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {entries.map(e => (
                                        <span key={e} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-muted/40 text-[11px] font-medium text-foreground">
                                            {e.includes('@') && !e.startsWith('@') ? e : <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5 text-peach" />{e.replace(/^@/, '@')}</span>}
                                            <button onClick={() => removeEntry(e)} className="p-0.5 rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Result / action */}
                    {url ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-border/40 bg-muted/20">
                                <span className="flex-1 text-xs text-muted-foreground truncate">{url}</span>
                                <button
                                    onClick={copyUrl}
                                    className={cn("flex items-center gap-1.5 text-xs font-semibold transition-colors", copied ? "text-emerald-500" : "text-foreground hover:text-primary")}
                                >
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground/50 text-center">
                                You can re-open this dialog any time to change who has access.
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="w-full h-10 rounded-xl bg-foreground text-background text-xs font-bold tracking-wide hover:bg-foreground/90 transition-colors active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                            {creating ? 'Creating link...' : 'Create & copy link'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
