"use client"

import { useEffect, useState, useCallback } from "react"
import { Candidate } from "./CandidateCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Loader2, Globe, Lock, Save, Pencil, Sparkles, Briefcase, ExternalLink, Copy, Check, X, Trash2, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

interface CandidateDetailsProps {
    candidate: Candidate & { answers?: any[] }
    postingId?: string
    onRefresh?: () => void
}

interface Note {
    id: string
    content: string
    created_at: string
    created_by: string
    source?: string
}

interface Meeting {
    id: string
    candidate_name: string
    summary: string
    meeting_date: string
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

export function CandidateDetails({ candidate, postingId, onRefresh }: CandidateDetailsProps) {
    const { data: session } = useSession()
    const [stages, setStages] = useState<{ id: string; text: string }[]>([])
    const [loadingStages, setLoadingStages] = useState(false)
    const [updating, setUpdating] = useState(false)

    const [notes, setNotes] = useState<Note[]>([])
    const [meetings, setMeetings] = useState<Meeting[]>([])
    const [newNote, setNewNote] = useState("")
    const [savingNote, setSavingNote] = useState(false)
    const [newInternalNote, setNewInternalNote] = useState("")
    const [savingInternalNote, setSavingInternalNote] = useState(false)
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [editingNoteContent, setEditingNoteContent] = useState("")
    const [savingNoteEdit, setSavingNoteEdit] = useState(false)
    const [loadingContext, setLoadingContext] = useState(false)

    // Staff-side client decision (set/override/clear on the client's behalf)
    const [staffDecision, setStaffDecision] = useState<'accepted' | 'maybe' | 'rejected' | null>(candidate.clientDecision ?? null)
    const [staffDecisionBy, setStaffDecisionBy] = useState<string | null>(candidate.clientDecisionBy ?? null)
    const [savingStaffDecision, setSavingStaffDecision] = useState(false)

    useEffect(() => {
        setStaffDecision(candidate.clientDecision ?? null)
        setStaffDecisionBy(candidate.clientDecisionBy ?? null)
    }, [candidate.id, candidate.clientDecision, candidate.clientDecisionBy])

    const handleStaffDecision = async (next: 'accepted' | 'maybe' | 'rejected') => {
        if (savingStaffDecision) return
        const resolvedPostingId = postingId
        if (!resolvedPostingId) {
            toast.error('No posting associated with this candidate')
            return
        }
        const value = staffDecision === next ? null : next
        const prev = staffDecision
        const prevBy = staffDecisionBy
        setSavingStaffDecision(true)
        setStaffDecision(value)
        if (!value) setStaffDecisionBy(null)
        try {
            const res = await fetch('/api/report/decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: candidate.id,
                    postingId: resolvedPostingId,
                    decision: value,
                    candidateEmail: candidate.email || undefined,
                    stage: candidate.stage,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to save decision')
            }
            toast.success(value ? `Marked ${value} on the client's behalf` : 'Decision cleared')
            onRefresh?.()
        } catch (e) {
            setStaffDecision(prev)
            setStaffDecisionBy(prevBy)
            toast.error(e instanceof Error ? e.message : 'Failed to save decision')
        } finally {
            setSavingStaffDecision(false)
        }
    }

    const [portfolioPassword, setPortfolioPassword] = useState("")
    const [savingPassword, setSavingPassword] = useState(false)
    const [isEditingPassword, setIsEditingPassword] = useState(false)

    const [profileLocation, setProfileLocation] = useState("")
    const [profilePitch, setProfilePitch] = useState("")
    const [profileSalary, setProfileSalary] = useState("")
    const [profileExp, setProfileExp] = useState("")
    const [profileTotalExp, setProfileTotalExp] = useState("")
    const [expSummary, setExpSummary] = useState("")
    const [savingProfile, setSavingProfile] = useState(false)
    const [isEditingPitch, setIsEditingPitch] = useState(false)
    const [isEditingMetadata, setIsEditingMetadata] = useState(false)
    const [generatingPitch, setGeneratingPitch] = useState(false)
    const [copiedPassword, setCopiedPassword] = useState(false)

    const normalizedLinks = candidate.links?.map(link => {
        if (typeof link === 'string') return { url: link, type: 'Link' }
        return link
    }) || []

    function getLinkInfo(url: string): { label: string; icon: React.ReactNode } {
        try {
            const hostname = new URL(url).hostname.replace('www.', '')
            const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`
            const favicon = <img src={faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm" />

            if (hostname.includes('linkedin.com')) return { label: 'LinkedIn', icon: favicon }
            if (hostname.includes('figma.com')) return { label: 'Figma', icon: favicon }
            if (hostname.includes('github.com')) return { label: 'GitHub', icon: favicon }
            if (hostname.includes('dribbble.com')) return { label: 'Dribbble', icon: favicon }
            if (hostname.includes('behance.net')) return { label: 'Behance', icon: favicon }
            if (hostname.includes('notion.so') || hostname.includes('notion.site')) return { label: 'Notion', icon: favicon }
            if (hostname.includes('read.cv')) return { label: 'Read.cv', icon: favicon }
            if (hostname.includes('medium.com')) return { label: 'Medium', icon: favicon }
            if (hostname.includes('twitter.com') || hostname.includes('x.com')) return { label: 'X', icon: favicon }

            // For everything else, use favicon + cleaned hostname
            const label = hostname.replace(/\.(com|co|io|org|net|design|me|dev|app|site|xyz)$/i, '')
            return { label: label.charAt(0).toUpperCase() + label.slice(1), icon: favicon }
        } catch {
            return { label: 'Link', icon: <Globe className="w-3 h-3" /> }
        }
    }

    const fetchContext = useCallback(async () => {
        if (!candidate.email && !candidate.name) return
        setLoadingContext(true)
        setProfileLocation(candidate.location || "Remote")
        try {
            const query = new URLSearchParams()
            if (candidate.email) query.append('email', candidate.email)
            if (candidate.name) query.append('name', candidate.name)

            const [notesRes, meetingsRes, passwordRes, profileRes, pitchRes, resumeRes] = await Promise.all([
                fetch(`/api/candidates/${candidate.email || 'unknown'}/notes`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/meeting-info?${query.toString()}`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/portfolio-password`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/profile`),
                postingId
                    ? fetch(`/api/candidates/${candidate.email || 'unknown'}/pitch?postingId=${postingId}`)
                    : Promise.resolve(null),
                fetch(`/api/lever/candidates/${candidate.id}/resume-info?${new URLSearchParams({
                    ...(postingId ? { postingId } : {}),
                    ...(candidate.email ? { email: candidate.email } : {})
                }).toString()}`)
            ])

            if (notesRes.ok) {
                const data = await notesRes.json()
                setNotes(data.notes || [])
            }

            if (meetingsRes.ok) {
                const data = await meetingsRes.json()
                setMeetings(data.meetings || [])
            }

            if (passwordRes.ok) {
                const data = await passwordRes.json()
                if (data.password) {
                    setPortfolioPassword(data.password)
                } else if (candidate.answers) {
                    // Try to extract portfolio password from Lever application answers
                    const pwAnswer = candidate.answers.find((a: any) => {
                        const q = (a.text || '').toLowerCase()
                        const v = typeof a.value === 'string' ? a.value.trim() : ''
                        // URLs are portfolio links, not passwords
                        return v && !/^https?:\/\//i.test(v) && (q.includes('password') || q.includes('passcode'))
                    })
                    if (pwAnswer?.value) setPortfolioPassword(String(pwAnswer.value).trim())
                }
            }

            if (profileRes.ok) {
                const data = await profileRes.json()
                if (data.profile) {
                    setProfileSalary(data.profile.salary_expectations || "")
                } else if (candidate.answers) {
                    const salaryAnswer = candidate.answers?.find(a =>
                        a.text.toLowerCase().includes('salary') ||
                        a.text.toLowerCase().includes('compensation')
                    )?.value || ""
                    setProfileSalary(salaryAnswer)
                }
            }

            if (pitchRes && pitchRes.ok) {
                const data = await pitchRes.json()
                if (data.pitch) setProfilePitch(data.pitch)
            }

            if (resumeRes.ok) {
                const data = await resumeRes.json()
                if (data.relevantYears != null) {
                    setProfileExp(`${data.relevantYears} yr relevant`)
                    if (data.totalYears) setProfileTotalExp(`${data.totalYears} yr total`)
                    if (data.summary) setExpSummary(data.summary)
                } else if (data.years) {
                    setProfileExp(data.years)
                }
            }
        } catch (e) {
            console.error("Failed to fetch context", e)
        } finally {
            setLoadingContext(false)
        }
    }, [candidate.email, candidate.name, candidate.id, candidate.answers, profileExp, postingId])

    useEffect(() => {
        async function fetchStages() {
            setLoadingStages(true)
            try {
                const res = await fetch('/api/lever/stages')
                if (res.ok) {
                    const data = await res.json()
                    setStages(data.stages || [])
                }
            } catch (e) {
                console.error("Failed to fetch stages", e)
            } finally {
                setLoadingStages(false)
            }
        }
        fetchStages()
        fetchContext()
    }, [fetchContext])

    const handleSaveProfile = async () => {
        if (!candidate.email) return
        setSavingProfile(true)
        try {
            const promises: Promise<Response>[] = [
                fetch(`/api/candidates/${candidate.email}/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        salary_expectations: profileSalary,
                        years_of_experience: profileExp
                    })
                })
            ]

            // Save pitch to role-specific endpoint if we have a postingId
            if (postingId && profilePitch) {
                promises.push(
                    fetch(`/api/candidates/${candidate.email}/pitch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ postingId, pitch: profilePitch })
                    })
                )
            }

            const results = await Promise.all(promises)
            if (results.every(r => r.ok)) {
                toast.success("Profile saved")
                setIsEditingPitch(false)
                setIsEditingMetadata(false)
            }
        } catch (e) {
            toast.error("Failed to save profile")
        } finally {
            setSavingProfile(false)
        }
    }

    const handleStageUpdate = async (newStageId: string) => {
        setUpdating(true)
        try {
            const res = await fetch(`/api/lever/candidates/${candidate.id}/stage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stageId: newStageId })
            })

            if (res.ok) {
                toast.success(`Moved ${candidate.name} to ${stages.find(s => s.id === newStageId)?.text || 'new stage'}`)
                if (onRefresh) onRefresh()
            } else {
                const error = await res.json()
                toast.error(error.error || "Failed to update stage")
            }
        } catch (e) {
            toast.error("An error occurred while updating stage")
        } finally {
            setUpdating(false)
        }
    }

    const postNote = async (content: string, source: 'internal' | null, clear: () => void, setSaving: (b: boolean) => void) => {
        if (!content.trim() || !candidate.email) return
        setSaving(true)
        try {
            const res = await fetch(`/api/candidates/${candidate.email}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    author: session?.user?.name || session?.user?.email || "Unknown",
                    ...(source ? { source } : {}),
                })
            })
            if (res.ok) {
                clear()
                fetchContext()
                toast.success("Note added")
            }
        } catch (e) {
            toast.error("Failed to save note")
        } finally {
            setSaving(false)
        }
    }
    const handleAddNote = () => postNote(newNote, null, () => setNewNote(""), setSavingNote)
    const handleAddInternalNote = () => postNote(newInternalNote, 'internal', () => setNewInternalNote(""), setSavingInternalNote)

    const handleDeleteNote = async (noteId: string) => {
        if (!candidate.email || deletingNoteId) return
        setDeletingNoteId(noteId)
        try {
            const res = await fetch(`/api/candidates/${candidate.email}/notes`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId })
            })
            if (res.ok) {
                setNotes(prev => prev.filter(n => n.id !== noteId))
                toast.success("Comment deleted")
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || "Failed to delete comment")
            }
        } catch (e) {
            toast.error("Failed to delete comment")
        } finally {
            setDeletingNoteId(null)
        }
    }

    const handleEditNote = async (noteId: string) => {
        if (!candidate.email || !editingNoteContent.trim() || savingNoteEdit) return
        setSavingNoteEdit(true)
        try {
            const res = await fetch(`/api/candidates/${candidate.email}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId, content: editingNoteContent.trim() })
            })
            if (res.ok) {
                const data = await res.json().catch(() => ({}))
                setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: data.note?.content ?? editingNoteContent.trim() } : n))
                setEditingNoteId(null)
                setEditingNoteContent("")
                toast.success("Comment updated")
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || "Failed to update comment")
            }
        } catch (e) {
            toast.error("Failed to update comment")
        } finally {
            setSavingNoteEdit(false)
        }
    }

    const handleSavePassword = async () => {
        if (!candidate.email) return
        setSavingPassword(true)
        try {
            const res = await fetch(`/api/candidates/${candidate.email}/portfolio-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: portfolioPassword })
            })
            if (res.ok) {
                toast.success("Password updated")
                setIsEditingPassword(false)
            }
        } catch (e) {
            toast.error("Failed to save password")
        } finally {
            setSavingPassword(false)
        }
    }

    const handleGeneratePitch = async (autoSave = false) => {
        setGeneratingPitch(true)
        try {
            const res = await fetch(`/api/candidates/${candidate.email || 'unknown'}/generate-pitch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateName: candidate.name,
                    postingId: postingId,
                    links: normalizedLinks,
                })
            })
            const data = await res.json()
            if (res.ok && data.pitch) {
                setProfilePitch(data.pitch)
                if (autoSave && candidate.email && postingId) {
                    // Auto-save the pitch to role-specific endpoint
                    await fetch(`/api/candidates/${candidate.email}/pitch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ postingId, pitch: data.pitch })
                    })
                    toast.success("Pitch auto-generated and saved")
                } else {
                    setIsEditingPitch(true)
                    toast.success("Pitch generated — review and save when ready")
                }
            } else if (!autoSave) {
                toast.error(data.error || "Failed to generate pitch")
            }
        } catch (e) {
            if (!autoSave) {
                toast.error("An error occurred while generating the pitch")
            }
        } finally {
            setGeneratingPitch(false)
        }
    }

    const currentStageObj = stages.find(s => s.text.toLowerCase() === candidate.stage.toLowerCase())
    const hasPitch = !!profilePitch
    const avatarGradient = nameToColor(candidate.name)
    const initials = candidate.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    // Staff can edit/delete a comment if they authored it; admins can modify any.
    const isAdminUser = (session?.user as any)?.isAdmin === true
    const canModifyNote = (note: Note) =>
        isAdminUser || note.created_by === session?.user?.name || note.created_by === session?.user?.email

    const renderNote = (note: Note) => (
        <div key={note.id} className="group/note p-3 rounded-xl bg-card/50 border border-border/10 hover:border-border/20 transition-colors duration-200">
            <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-primary/60 truncate">{note.created_by}</span>
                    {note.source === 'client' && (
                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-peach/20 text-foreground/50 shrink-0">Client</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground/30">{new Date(note.created_at).toLocaleDateString()}</span>
                    {canModifyNote(note) && editingNoteId !== note.id && (
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content) }}
                                className="p-1 rounded-md text-muted-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors"
                                title="Edit comment"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => handleDeleteNote(note.id)}
                                disabled={deletingNoteId === note.id}
                                className="p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete comment"
                            >
                                {deletingNoteId === note.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {editingNoteId === note.id ? (
                <div className="space-y-2">
                    <Textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        className="min-h-[60px] bg-muted/15 border-border/15 rounded-lg p-2.5 text-xs font-medium resize-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                        <button
                            onClick={() => { setEditingNoteId(null); setEditingNoteContent("") }}
                            className="px-2.5 h-7 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleEditNote(note.id)}
                            disabled={!editingNoteContent.trim() || savingNoteEdit}
                            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {savingNoteEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-foreground/70 leading-relaxed">{note.content}</p>
            )}
        </div>
    )

    return (
        <div className="flex flex-col h-full space-y-6 md:space-y-8">
            {/* Hero */}
            <div className="space-y-4 md:space-y-5">
                <div className="flex items-start gap-3 md:gap-4">
                    <div className={cn("w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-foreground/70 font-bold text-sm md:text-base shrink-0", avatarGradient)}>
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                            {candidate.name}
                        </h2>
                        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                            {candidate.headline || "No headline"}
                        </p>
                    </div>
                    <a
                        href={`https://hire.lever.co/candidates/${candidate.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-200"
                        title="Open in Lever (staff only — clients never see this)"
                    >
                        <ExternalLink className="w-3 h-3" /> Lever
                    </a>
                </div>

                {/* Quick links */}
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {normalizedLinks.map((link, i) => {
                        const info = getLinkInfo(link.url)
                        const isPortfolio = !link.url.includes('linkedin.com')
                        return (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-200">
                                {info.icon} {info.label}
                                {isPortfolio && portfolioPassword && <Lock className="w-2.5 h-2.5 text-peach" />}
                            </a>
                        )
                    })}
                    {candidate.email && (
                        <a href={`mailto:${candidate.email}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-200">
                            <Mail className="w-3 h-3" /> Email
                        </a>
                    )}
                </div>

                {/* Portfolio Password — inline near links */}
                {normalizedLinks.some(l => !l.url.includes('linkedin.com')) && (
                    <div className="relative group/pw max-w-[200px]">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 group-focus-within/pw:text-primary transition-colors" />
                        <Input
                            type="text"
                            placeholder="Portfolio password"
                            value={portfolioPassword}
                            onChange={(e) => {
                                setPortfolioPassword(e.target.value)
                                if (!isEditingPassword) setIsEditingPassword(true)
                            }}
                            onBlur={() => {
                                handleSavePassword()
                            }}
                            className="h-7 pl-8 pr-8 bg-muted/20 border-border/15 rounded-lg text-[11px] font-medium focus:bg-muted/30 transition-all"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {isEditingPassword ? (
                                savingPassword ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Save className="h-3 w-3 text-primary" />
                            ) : portfolioPassword ? (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(portfolioPassword)
                                        setCopiedPassword(true)
                                        setTimeout(() => setCopiedPassword(false), 1500)
                                    }}
                                    className="text-muted-foreground/30 hover:text-foreground transition-colors"
                                >
                                    {copiedPassword ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </button>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {/* Client decision — set from the shared report, or here by staff on
                the client's behalf (feedback often arrives on calls). */}
            <div className={cn(
                "rounded-xl px-4 py-3 border",
                staffDecision === 'accepted' ? "bg-emerald-500/5 border-emerald-500/15" :
                staffDecision === 'maybe' ? "bg-amber-500/5 border-amber-500/15" :
                staffDecision === 'rejected' ? "bg-destructive/5 border-destructive/15" :
                "bg-muted/20 border-border/40"
            )}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className={cn(
                            "text-xs font-bold",
                            staffDecision === 'accepted' ? "text-emerald-700" :
                            staffDecision === 'maybe' ? "text-amber-700" :
                            staffDecision === 'rejected' ? "text-destructive/80" :
                            "text-muted-foreground"
                        )}>
                            {staffDecision
                                ? `Client decision: ${staffDecision}`
                                : 'No client decision yet'}
                        </p>
                        {staffDecisionBy && staffDecision && (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">By {staffDecisionBy}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {(['accepted', 'maybe', 'rejected'] as const).map(d => (
                            <button
                                key={d}
                                type="button"
                                disabled={savingStaffDecision}
                                onClick={() => handleStaffDecision(d)}
                                title={staffDecision === d ? 'Click again to clear' : `Mark ${d} on the client's behalf`}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize border transition-colors disabled:opacity-50",
                                    staffDecision === d
                                        ? d === 'accepted' ? "bg-emerald-500 text-white border-emerald-500"
                                            : d === 'maybe' ? "bg-amber-500 text-white border-amber-500"
                                            : "bg-destructive text-white border-destructive"
                                        : "bg-card text-muted-foreground border-border/50 hover:text-foreground"
                                )}
                            >
                                {d === 'accepted' ? 'Accept' : d === 'maybe' ? 'Maybe' : 'Reject'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-muted/20 rounded-xl p-4 md:p-5 relative group/meta">
                <div className="space-y-3">
                    {[
                        { label: "Location", value: profileLocation, field: "location" },
                        { label: "Relevant Exp", value: profileExp, field: "exp" },
                        { label: "Total Exp", value: profileTotalExp, field: "totalExp" },
                        { label: "Salary", value: profileSalary, field: "salary" },
                    ].filter(item => item.value || isEditingMetadata).map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 shrink-0">{item.label}</span>
                            {isEditingMetadata ? (
                                <Input
                                    value={item.field === "location" ? profileLocation : item.field === "exp" ? profileExp : item.field === "totalExp" ? profileTotalExp : profileSalary}
                                    onChange={(e) => {
                                        if (item.field === "location") setProfileLocation(e.target.value)
                                        else if (item.field === "exp") setProfileExp(e.target.value)
                                        else if (item.field === "totalExp") setProfileTotalExp(e.target.value)
                                        else setProfileSalary(e.target.value)
                                    }}
                                    className="h-6 w-28 md:w-40 p-0 text-sm font-bold text-right bg-transparent border-none border-b border-primary/20 rounded-none focus:ring-0"
                                />
                            ) : (
                                <span className="text-xs md:text-sm font-bold tracking-tight truncate max-w-[140px] md:max-w-[200px]">{item.value || "—"}</span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-end mt-3">
                    {isEditingMetadata ? (
                        <button onClick={() => { handleSaveProfile(); setIsEditingMetadata(false) }} disabled={savingProfile}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors duration-200">
                            {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                        </button>
                    ) : (
                        <button onClick={() => setIsEditingMetadata(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors duration-200 text-[10px] font-bold uppercase tracking-wider">
                            <Pencil className="w-2.5 h-2.5" /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* The Pitch */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-peach" />
                        <span className="text-xs font-bold text-foreground/70">The Pitch</span>
                    </div>
                    {hasPitch && (
                        <div className="flex items-center gap-1 md:gap-1.5 flex-wrap justify-end">
                            <button
                                onClick={() => handleGeneratePitch()}
                                disabled={generatingPitch}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-peach hover:text-foreground hover:bg-peach/10 transition-colors duration-200"
                            >
                                {generatingPitch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {generatingPitch ? "Generating..." : "Regenerate"}
                            </button>
                            {isEditingPitch ? (
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-all"
                                >
                                    {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Save
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditingPitch(true)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all"
                                >
                                    <Pencil className="w-3 h-3" /> Edit
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {!hasPitch && !isEditingPitch ? (
                    loadingContext ? (
                        <div className="bg-muted/20 rounded-xl p-6 border border-border/20 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/30" />
                        </div>
                    ) : (
                        <div className="bg-muted/20 rounded-xl p-6 border border-border/20 flex flex-col items-center gap-3">
                            <p className="text-sm text-muted-foreground/60 text-center">
                                Generate a pitch from interview transcripts and the job description
                            </p>
                            <button
                                onClick={() => handleGeneratePitch()}
                                disabled={generatingPitch}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold tracking-wide hover:bg-foreground/90 transition-[color,background-color,transform] duration-200 ease-smooth disabled:opacity-70 shadow-sm"
                            >
                                {generatingPitch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {generatingPitch ? "Generating pitch..." : "Generate Pitch"}
                            </button>
                        </div>
                    )
                ) : isEditingPitch ? (
                    <Textarea
                        value={profilePitch}
                        onChange={(e) => setProfilePitch(e.target.value)}
                        className="min-h-[200px] text-sm text-foreground leading-relaxed font-medium bg-muted/20 border-border/20 rounded-xl p-4 focus:bg-muted/30 transition-[background-color,border-color] duration-200 resize-none"
                        placeholder="Write the executive pitch..."
                    />
                ) : (
                    <div className="bg-muted/15 rounded-xl p-4 border border-border/10">
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            {profilePitch}
                        </p>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-4 pt-4 border-t border-border/15">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Pipeline Controls</span>

                <div className="grid grid-cols-1 gap-3">
                    <div className="bg-muted/15 p-4 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Stage</span>
                        <div onClick={(e) => e.stopPropagation()}>
                            <Select
                                onValueChange={handleStageUpdate}
                                value={currentStageObj?.id}
                                disabled={updating || loadingStages}
                            >
                                <SelectTrigger className="h-9 w-full bg-card border-border/30 rounded-lg px-3 text-xs font-bold text-foreground hover:bg-card/80 transition-colors duration-200">
                                    {updating ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-primary" />
                                    ) : (
                                        <SelectValue placeholder={candidate.stage} />
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/30 shadow-xl bg-background/95 backdrop-blur-md">
                                    {stages.map((stage) => (
                                        <SelectItem key={stage.id} value={stage.id} className="text-xs font-medium rounded-lg my-0.5 mx-1">
                                            {stage.text}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                </div>
            </div>

            {/* Notes — Team Feedback is shared with the client; Internal Only never leaves the team */}
            {([
                { key: 'team', title: 'Team Feedback', hint: 'Visible to the client on the shared report', list: notes.filter(n => n.source !== 'internal'), value: newNote, setValue: setNewNote, saving: savingNote, submit: handleAddNote, placeholder: 'Add a note for the team & client...' },
                { key: 'internal', title: 'Internal Only', hint: 'Never shown to clients', list: notes.filter(n => n.source === 'internal'), value: newInternalNote, setValue: setNewInternalNote, saving: savingInternalNote, submit: handleAddInternalNote, placeholder: 'Private note — internal eyes only...' },
            ]).map((sec) => (
                <div key={sec.key} className="space-y-3 pt-4 border-t border-border/15">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1">
                            {sec.key === 'internal' && <Lock className="w-2.5 h-2.5" />}
                            {sec.title}
                        </span>
                        <span className="text-[9px] text-muted-foreground/35 font-medium">{sec.hint}</span>
                    </div>

                    <div className="relative">
                        <Textarea
                            placeholder={sec.placeholder}
                            value={sec.value}
                            onChange={(e) => sec.setValue(e.target.value)}
                            className="min-h-[80px] bg-muted/15 border-border/15 rounded-xl p-3 pr-12 text-xs font-medium focus:bg-muted/25 transition-[background-color,border-color] duration-200 resize-none"
                        />
                        <Button
                            size="icon"
                            disabled={!sec.value.trim() || sec.saving}
                            onClick={sec.submit}
                            className="absolute bottom-2.5 right-2.5 h-7 w-7 rounded-lg bg-peach text-foreground shadow-sm hover:bg-peach/80 transition-colors duration-200"
                        >
                            {sec.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </Button>
                    </div>

                    {sec.list.length > 0 && (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            {sec.list.map(renderNote)}
                        </div>
                    )}
                </div>
            ))}

            {/* Lever Link */}
            <div className="pt-4 pb-8">
                <a
                    href={`https://hire.lever.co/candidates/${candidate.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-foreground text-background text-xs font-bold tracking-wide hover:bg-foreground/90 transition-[background-color,box-shadow,transform] duration-300 ease-smooth shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Briefcase className="w-3.5 h-3.5" />
                    View in Lever
                    <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
            </div>
        </div>
    )
}
