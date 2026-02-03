"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Candidate } from "./CandidateCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, MapPin, Mail, Calendar, Loader2, MessageSquare, Plus, Globe, Lock, Save, Pencil, Linkedin, Sparkles, Briefcase } from "lucide-react"
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
    onRefresh?: () => void
}

interface Note {
    id: string
    content: string
    created_at: string
    created_by: string
}

interface Meeting {
    id: string
    candidate_name: string
    summary: string
    meeting_date: string
}

export function CandidateDetails({ candidate, onRefresh }: CandidateDetailsProps) {
    const { data: session } = useSession()
    const [stages, setStages] = useState<{ id: string; text: string }[]>([])
    const [loadingStages, setLoadingStages] = useState(false)
    const [updating, setUpdating] = useState(false)

    const [notes, setNotes] = useState<Note[]>([])
    const [meetings, setMeetings] = useState<Meeting[]>([])
    const [newNote, setNewNote] = useState("")
    const [savingNote, setSavingNote] = useState(false)
    const [loadingContext, setLoadingContext] = useState(false)

    const [portfolioPassword, setPortfolioPassword] = useState("")
    const [savingPassword, setSavingPassword] = useState(false)
    const [isEditingPassword, setIsEditingPassword] = useState(false)

    // Executive Sell Profile Data
    const [profilePitch, setProfilePitch] = useState("")
    const [profileSalary, setProfileSalary] = useState("")
    const [profileExp, setProfileExp] = useState("")
    const [savingProfile, setSavingProfile] = useState(false)
    const [isEditingPitch, setIsEditingPitch] = useState(false)
    const [isEditingMetadata, setIsEditingMetadata] = useState(false)

    // Normalize links
    const normalizedLinks = candidate.links?.map(link => {
        if (typeof link === 'string') return { url: link, type: 'Link' }
        return link
    }) || []
    const linkedIn = normalizedLinks.find(l => l.url.includes('linkedin.com'))
    const portfolio = normalizedLinks.find(l => !l.url.includes('linkedin.com'))

    const fetchContext = useCallback(async () => {
        if (!candidate.email && !candidate.name) return
        setLoadingContext(true)
        try {
            const query = new URLSearchParams()
            if (candidate.email) query.append('email', candidate.email)
            if (candidate.name) query.append('name', candidate.name)

            const [notesRes, meetingsRes, passwordRes, profileRes, resumeRes] = await Promise.all([
                fetch(`/api/candidates/${candidate.email || 'unknown'}/notes`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/meeting-info?${query.toString()}`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/portfolio-password`),
                fetch(`/api/candidates/${candidate.email || 'unknown'}/profile`),
                fetch(`/api/lever/candidates/${candidate.id}/resume-info`)
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
                if (data.password) setPortfolioPassword(data.password)
            }

            // Sync Profile Data
            if (profileRes.ok) {
                const data = await profileRes.json()
                if (data.profile) {
                    setProfilePitch(data.profile.pitch || "")
                    setProfileSalary(data.profile.salary_expectations || "")
                    setProfileExp(data.profile.years_of_experience || "")
                } else if (candidate.answers) {
                    const salaryAnswer = candidate.answers?.find(a =>
                        a.text.toLowerCase().includes('salary') ||
                        a.text.toLowerCase().includes('compensation')
                    )?.value || ""
                    setProfileSalary(salaryAnswer)
                }
            }

            if (!profileExp && resumeRes.ok) {
                const data = await resumeRes.json()
                if (data.years) setProfileExp(data.years)
            }
        } catch (e) {
            console.error("Failed to fetch context", e)
        } finally {
            setLoadingContext(false)
        }
    }, [candidate.email, candidate.name, candidate.id, candidate.answers, profileExp])

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
            const res = await fetch(`/api/candidates/${candidate.email}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pitch: profilePitch,
                    salary_expectations: profileSalary,
                    years_of_experience: profileExp
                })
            })
            if (res.ok) {
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

    const handleAddNote = async () => {
        if (!newNote.trim() || !candidate.email) return
        setSavingNote(true)
        try {
            const res = await fetch(`/api/candidates/${candidate.email}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newNote,
                    author: session?.user?.name || session?.user?.email || "Unknown"
                })
            })
            if (res.ok) {
                setNewNote("")
                fetchContext()
                toast.success("Note added")
            }
        } catch (e) {
            toast.error("Failed to save note")
        } finally {
            setSavingNote(false)
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

    const currentStageObj = stages.find(s => s.text.toLowerCase() === candidate.stage.toLowerCase())

    const displayedPitch = profilePitch || (meetings.length > 0 ? meetings[0].summary : candidate.headline)

    return (
        <div className="flex flex-col h-full space-y-12">
            <div className="space-y-6">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter text-foreground leading-none flex flex-wrap items-baseline gap-x-2">
                        {candidate.name}
                        <span className="text-foreground/10 font-thin">|</span>
                        <div className="flex items-center gap-4 text-[10px] tracking-widest uppercase font-black">
                            {linkedIn && (
                                <a href={linkedIn.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Linkedin</a>
                            )}
                            {portfolio && (
                                <a href={portfolio.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1.5">
                                    Portfolio {portfolioPassword && <Lock className="w-2 h-2 opacity-30 text-peach" />}
                                </a>
                            )}
                        </div>
                    </h2>
                </div>

                <div className="grid grid-cols-3 gap-6 border-y border-border/10 py-6 relative group/meta">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Location</span>
                        <p className="text-sm font-bold tracking-tight">{candidate.location || "Remote"}</p>
                    </div>

                    <div className="space-y-1 relative">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Exp</span>
                        {isEditingMetadata ? (
                            <Input
                                value={profileExp}
                                onChange={(e) => setProfileExp(e.target.value)}
                                className="h-6 p-0 text-sm font-bold bg-transparent border-none border-b border-primary/20 rounded-none focus:ring-0"
                                autoFocus
                            />
                        ) : (
                            <p className="text-sm font-bold tracking-tight">{profileExp || "—"}</p>
                        )}
                    </div>

                    <div className="space-y-1 relative">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Expectations</span>
                        {isEditingMetadata ? (
                            <Input
                                value={profileSalary}
                                onChange={(e) => setProfileSalary(e.target.value)}
                                className="h-6 p-0 text-sm font-bold bg-transparent border-none border-b border-primary/20 rounded-none focus:ring-0"
                            />
                        ) : (
                            <p className="text-sm font-bold tracking-tight italic truncate">{profileSalary || "—"}</p>
                        )}
                    </div>

                    <div className="absolute top-2 right-0">
                        {isEditingMetadata ? (
                            <button onClick={handleSaveProfile} disabled={savingProfile} className="text-primary hover:scale-110 transition-transform">
                                {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </button>
                        ) : (
                            <button onClick={() => setIsEditingMetadata(true)} className="opacity-0 group-hover/meta:opacity-100 text-muted-foreground/30 hover:text-primary transition-all">
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4 group/pitch">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">The Pitch</span>
                            <Sparkles className="w-3 h-3 animate-pulse" />
                        </div>
                        {isEditingPitch ? (
                            <button
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"
                            >
                                {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                SAVE PITCH
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (!profilePitch) setProfilePitch(displayedPitch)
                                    setIsEditingPitch(true)
                                }}
                                className="opacity-0 group-hover/pitch:opacity-100 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-primary transition-all flex items-center gap-2"
                            >
                                <Pencil className="w-3 h-3" />
                                EDIT PITCH
                            </button>
                        )}
                    </div>

                    <div className="relative">
                        {isEditingPitch ? (
                            <Textarea
                                value={profilePitch}
                                onChange={(e) => setProfilePitch(e.target.value)}
                                className="min-h-[250px] text-lg text-foreground/90 leading-relaxed font-medium bg-input/40 border-primary/5 rounded-2xl p-6 focus:bg-input transition-all resize-none shadow-inner"
                                placeholder="Refine the pitch for the executive team..."
                            />
                        ) : (
                            <p className="text-lg text-foreground/90 leading-relaxed font-medium italic">
                                "{displayedPitch}"
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-border/5">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">Recruiter Controls</span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-input/20 p-5 rounded-2xl border border-border/5 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-foreground/20">Pipeline Stage</span>
                        <div onClick={(e) => e.stopPropagation()}>
                            <Select
                                onValueChange={handleStageUpdate}
                                value={currentStageObj?.id}
                                disabled={updating || loadingStages}
                            >
                                <SelectTrigger className="h-9 w-full bg-input/50 border-transparent rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.1em] text-foreground hover:bg-input transition-all">
                                    {updating ? (
                                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                                    ) : (
                                        <SelectValue placeholder={candidate.stage} />
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/10 shadow-2xl bg-background/95 backdrop-blur-md">
                                    {stages.map((stage) => (
                                        <SelectItem key={stage.id} value={stage.id} className="text-[11px] font-black uppercase tracking-[0.1em] rounded-lg my-1 mx-1">
                                            {stage.text}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {portfolio && (
                        <div className="bg-input/20 p-5 rounded-2xl border border-border/5 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-foreground/20">Portfolio Password</span>
                            <div className="relative group/pw">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 group-focus-within/pw:text-primary transition-colors" />
                                <Input
                                    type={isEditingPassword ? "text" : "password"}
                                    placeholder="PW"
                                    value={portfolioPassword}
                                    onChange={(e) => {
                                        setPortfolioPassword(e.target.value)
                                        if (!isEditingPassword) setIsEditingPassword(true)
                                    }}
                                    onBlur={() => {
                                        if (portfolioPassword) handleSavePassword()
                                        else setIsEditingPassword(false)
                                    }}
                                    className="h-9 pl-9 pr-12 bg-input/50 border-transparent rounded-xl text-xs font-bold tracking-widest focus:bg-input transition-all"
                                />
                                {isEditingPassword && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {savingPassword ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Save className="h-3.5 w-3.5 text-primary" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">Team Feedback</span>
                    <div className="relative group/note">
                        <Textarea
                            placeholder="Add team feedback..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="min-h-[100px] bg-input/10 border-transparent rounded-2xl p-4 text-[13px] font-medium placeholder:text-[9px] placeholder:font-black focus:bg-input/30 transition-all resize-none shadow-sm"
                        />
                        <Button
                            size="icon"
                            disabled={!newNote.trim() || savingNote}
                            onClick={handleAddNote}
                            className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-peach text-foreground shadow-sm hover:scale-105 transition-transform"
                        >
                            {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {notes.map((note) => (
                            <div key={note.id} className="space-y-2 p-4 rounded-xl bg-card/[0.03] border border-border/5 hover:border-border/10 transition-all">
                                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                                    <span className="text-primary/60">{note.created_by}</span>
                                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs font-medium text-foreground/80 leading-normal">{note.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="pt-4 pb-12">
                <a
                    href={`https://hire.lever.co/candidates/${candidate.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-foreground text-background font-black uppercase tracking-[0.2em] text-[11px] hover:bg-foreground/90 transition-all shadow-xl hover:-translate-y-1"
                >
                    <Briefcase className="w-4 h-4" />
                    Official Lever Profile
                </a>
            </div>
        </div>
    )
}
