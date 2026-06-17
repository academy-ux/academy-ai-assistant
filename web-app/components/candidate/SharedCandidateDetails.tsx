"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Candidate } from "./CandidateCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Globe, Lock, Copy, Check, Sparkles, Briefcase, Plus, Loader2, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { isPresentingStage } from "@/lib/stages"
import { toast } from "sonner"

interface SharedCandidateDetailsProps {
    candidate: Candidate
    token: string
    onDecisionChange?: (candidateId: string, decision: 'accepted' | 'rejected' | null) => void
}

interface ClientNote {
    id: string
    content: string
    created_at: string
    created_by: string
}

function nameToColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = [
        "from-amber-200 to-orange-200",
        "from-emerald-200 to-teal-200",
        "from-blue-200 to-indigo-200",
        "from-rose-200 to-pink-200",
        "from-violet-200 to-purple-200",
        "from-cyan-200 to-sky-200",
    ]
    return colors[Math.abs(hash) % colors.length]
}

// Remember the reviewer's name across candidates so they don't retype it.
const NAME_KEY = 'shared-report-reviewer-name'

export function SharedCandidateDetails({ candidate, token, onDecisionChange }: SharedCandidateDetailsProps) {
    const normalizedLinks = candidate.links?.map(link => {
        if (typeof link === 'string') return { url: link, type: 'Link' }
        return link
    }) || []

    const canDecide = isPresentingStage(candidate.stage) && !candidate.archivedAt

    const [reviewerName, setReviewerName] = useState("")
    const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(candidate.clientDecision ?? null)
    const [savingDecision, setSavingDecision] = useState(false)

    const [notes, setNotes] = useState<ClientNote[]>([])
    const [newNote, setNewNote] = useState("")
    const [savingNote, setSavingNote] = useState(false)

    const [copiedPassword, setCopiedPassword] = useState(false)

    // Reset transient state when the selected candidate changes.
    useEffect(() => {
        setDecision(candidate.clientDecision ?? null)
        setNewNote("")
    }, [candidate.id, candidate.clientDecision])

    useEffect(() => {
        try {
            const saved = localStorage.getItem(NAME_KEY)
            if (saved) setReviewerName(saved)
        } catch { /* ignore */ }
    }, [])

    const persistName = useCallback((name: string) => {
        setReviewerName(name)
        try { localStorage.setItem(NAME_KEY, name) } catch { /* ignore */ }
    }, [])

    const fetchNotes = useCallback(async () => {
        try {
            const res = await fetch(`/api/share/${token}/notes?candidateId=${candidate.id}`)
            if (res.ok) {
                const data = await res.json()
                setNotes(data.notes || [])
            }
        } catch { /* ignore */ }
    }, [token, candidate.id])

    useEffect(() => { fetchNotes() }, [fetchNotes])

    function getLinkInfo(url: string): { label: string; icon: React.ReactNode } {
        try {
            const hostname = new URL(url).hostname.replace('www.', '')
            const favicon = <img src={`https://www.google.com/s2/favicons?sz=32&domain=${hostname}`} alt="" className="w-3.5 h-3.5 rounded-sm" />
            if (hostname.includes('linkedin.com')) return { label: 'LinkedIn', icon: favicon }
            if (hostname.includes('figma.com')) return { label: 'Figma', icon: favicon }
            if (hostname.includes('github.com')) return { label: 'GitHub', icon: favicon }
            if (hostname.includes('dribbble.com')) return { label: 'Dribbble', icon: favicon }
            if (hostname.includes('behance.net')) return { label: 'Behance', icon: favicon }
            if (hostname.includes('notion.so') || hostname.includes('notion.site')) return { label: 'Notion', icon: favicon }
            if (hostname.includes('read.cv')) return { label: 'Read.cv', icon: favicon }
            const label = hostname.replace(/\.(com|co|io|org|net|design|me|dev|app|site|xyz)$/i, '')
            return { label: label.charAt(0).toUpperCase() + label.slice(1), icon: favicon }
        } catch {
            return { label: 'Link', icon: <Globe className="w-3 h-3" /> }
        }
    }

    const handleDecision = async (next: 'accepted' | 'rejected') => {
        if (savingDecision) return
        // Toggle off if the same decision is tapped again.
        const value: 'accepted' | 'rejected' | null = decision === next ? null : next
        setSavingDecision(true)
        const previous = decision
        setDecision(value) // optimistic
        try {
            const res = await fetch(`/api/share/${token}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId: candidate.id, decision: value, decidedBy: reviewerName || undefined }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to save')
            }
            onDecisionChange?.(candidate.id, value)
            toast.success(
                value === 'accepted' ? 'Marked as accepted' :
                value === 'rejected' ? 'Marked as rejected' : 'Decision cleared'
            )
        } catch (e) {
            setDecision(previous) // revert
            toast.error(e instanceof Error ? e.message : 'Failed to save decision')
        } finally {
            setSavingDecision(false)
        }
    }

    const handleAddNote = async () => {
        if (!newNote.trim() || savingNote) return
        setSavingNote(true)
        try {
            const res = await fetch(`/api/share/${token}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId: candidate.id, content: newNote.trim(), author: reviewerName || undefined }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to save')
            }
            setNewNote("")
            await fetchNotes()
            toast.success("Comment added")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to add comment')
        } finally {
            setSavingNote(false)
        }
    }

    const avatarGradient = nameToColor(candidate.name)
    const initials = candidate.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const hasPortfolio = normalizedLinks.some(l => !l.url.includes('linkedin.com'))

    return (
        <div className="flex flex-col h-full space-y-8">
            {/* Hero */}
            <div className="space-y-5">
                <div className="flex items-start gap-4">
                    <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-foreground/70 font-bold text-base shrink-0", avatarGradient)}>
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                            {candidate.name}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {candidate.headline || "No headline"}
                        </p>
                    </div>
                    {decision && (
                        <span className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            decision === 'accepted'
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-destructive/10 text-destructive/80"
                        )}>
                            {decision === 'accepted' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                            {decision}
                        </span>
                    )}
                </div>

                {/* Links */}
                <div className="flex items-center gap-2 flex-wrap">
                    {normalizedLinks.map((link, i) => {
                        const info = getLinkInfo(link.url)
                        const isPortfolio = !link.url.includes('linkedin.com')
                        return (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-200">
                                {info.icon} {info.label}
                                {isPortfolio && candidate.portfolioPassword && <Lock className="w-2.5 h-2.5 text-peach" />}
                            </a>
                        )
                    })}
                </div>

                {/* Portfolio password */}
                {hasPortfolio && candidate.portfolioPassword && (
                    <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 max-w-[280px]">
                        <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 shrink-0">Portfolio</span>
                        <span className="text-xs font-bold tracking-tight truncate flex-1">{candidate.portfolioPassword}</span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(candidate.portfolioPassword!)
                                setCopiedPassword(true)
                                setTimeout(() => setCopiedPassword(false), 1500)
                            }}
                            className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0"
                            title="Copy password"
                        >
                            {copiedPassword ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="bg-muted/20 rounded-xl p-5">
                <div className="space-y-3">
                    {[
                        { label: "Location", value: candidate.location || "Remote" },
                        { label: "Stage", value: candidate.stage },
                        { label: "Position", value: candidate.position },
                        { label: "Relevant Exp", value: candidate.relevantYears != null ? `${candidate.relevantYears} yr` : null },
                        { label: "Total Exp", value: candidate.totalYears != null ? `${candidate.totalYears} yr` : null },
                        { label: "Salary", value: candidate.salary },
                        ...(candidate.createdAt ? [{
                            label: "Applied",
                            value: new Date(candidate.createdAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                            })
                        }] : []),
                    ].filter(item => item.value).map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 shrink-0">{item.label}</span>
                            <span className="text-sm font-bold tracking-tight truncate max-w-[200px]">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* The Pitch */}
            {candidate.pitch && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-peach" />
                        <span className="text-xs font-bold text-foreground/70">The Pitch</span>
                    </div>
                    <div className="bg-muted/15 rounded-xl p-4 border border-border/10">
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {candidate.pitch}
                        </p>
                    </div>
                </div>
            )}

            {/* Experience summary */}
            {candidate.experienceSummary && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <span className="text-xs font-bold text-foreground/70">Experience</span>
                    </div>
                    <div className="bg-muted/15 rounded-xl p-4 border border-border/10">
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {candidate.experienceSummary}
                        </p>
                    </div>
                </div>
            )}

            {/* Your name (used for decision + comments) */}
            <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Your Name</span>
                <Input
                    placeholder="Add your name (optional)"
                    value={reviewerName}
                    onChange={(e) => persistName(e.target.value)}
                    className="h-9 bg-muted/15 border-border/15 rounded-xl text-xs font-medium focus:bg-muted/25 transition-colors"
                />
            </div>

            {/* Accept / Reject — presenting candidates only */}
            {canDecide && (
                <div className="space-y-3 pt-4 border-t border-border/15">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Your Decision</span>
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">
                        Let us know if you'd like to move forward with this candidate. This won't change their stage — our team follows up on your feedback.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleDecision('accepted')}
                            disabled={savingDecision}
                            className={cn(
                                "flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold tracking-wide transition-[color,background-color,transform] duration-200 active:scale-[0.98] disabled:opacity-60",
                                decision === 'accepted'
                                    ? "bg-emerald-500 text-white shadow-sm"
                                    : "border border-border/40 text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                            )}
                        >
                            {savingDecision ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                            Accept
                        </button>
                        <button
                            onClick={() => handleDecision('rejected')}
                            disabled={savingDecision}
                            className={cn(
                                "flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold tracking-wide transition-[color,background-color,transform] duration-200 active:scale-[0.98] disabled:opacity-60",
                                decision === 'rejected'
                                    ? "bg-destructive text-white shadow-sm"
                                    : "border border-border/40 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                            )}
                        >
                            {savingDecision ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                            Reject
                        </button>
                    </div>
                    {decision && (
                        <p className="text-[11px] text-muted-foreground/50 text-center">
                            Tap the {decision === 'accepted' ? 'Accept' : 'Reject'} button again to clear your decision.
                        </p>
                    )}
                </div>
            )}

            {/* Comments */}
            <div className="space-y-3 pt-4 border-t border-border/15">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Your Comments</span>

                <div className="relative">
                    <Textarea
                        placeholder="Share your thoughts on this candidate..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="min-h-[80px] bg-muted/15 border-border/15 rounded-xl p-3 pr-12 text-xs font-medium focus:bg-muted/25 transition-colors resize-none"
                    />
                    <Button
                        size="icon"
                        disabled={!newNote.trim() || savingNote}
                        onClick={handleAddNote}
                        className="absolute bottom-2.5 right-2.5 h-7 w-7 rounded-lg bg-peach text-foreground shadow-sm hover:bg-peach/80 transition-colors duration-200"
                    >
                        {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                </div>

                {notes.length > 0 && (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {notes.map((note) => (
                            <div key={note.id} className="p-3 rounded-xl bg-card/50 border border-border/10">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold text-primary/60">{note.created_by}</span>
                                    <span className="text-[10px] text-muted-foreground/30">{new Date(note.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Archived notice */}
            {candidate.archivedAt && (
                <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4">
                    <p className="text-xs font-bold text-destructive/70">Archived</p>
                    {candidate.archivedReason && (
                        <p className="text-xs text-destructive/50 mt-1">{candidate.archivedReason}</p>
                    )}
                </div>
            )}
        </div>
    )
}
