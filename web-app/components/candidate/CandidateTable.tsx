"use client"

import { Badge } from "@/components/ui/badge"
import { MapPin, ChevronRight, Globe, Loader2, Briefcase } from "lucide-react"
import { Candidate } from "./CandidateCard"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState } from "react"
import { toast } from "sonner"

export interface ExperienceData {
    relevantYears: number
    totalYears: number
    summary: string
}

interface CandidateTableProps {
    candidates: Candidate[]
    onSelect: (candidate: Candidate) => void
    selectedId?: string
    stages?: { id: string, text: string }[]
    onRefresh?: () => void
    experienceMap?: Record<string, ExperienceData | null>
    experienceLoading?: boolean
    readOnly?: boolean
}

// Generate a consistent warm color from a name
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
        "from-lime-200 to-green-200",
        "from-yellow-200 to-amber-200",
    ]
    return colors[Math.abs(hash) % colors.length]
}

export function CandidateTable({ candidates, onSelect, selectedId, stages, onRefresh, experienceMap, experienceLoading, readOnly }: CandidateTableProps) {
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const handleUpdateStage = async (candidateId: string, stageId: string) => {
        setUpdatingId(candidateId)
        try {
            const res = await fetch(`/api/lever/candidates/${candidateId}/stage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stageId })
            })

            if (res.ok) {
                toast.success("Stage updated successfully")
                onRefresh?.()
            } else {
                const data = await res.json()
                toast.error(data.error || "Failed to update stage")
            }
        } catch (e) {
            console.error("Stage update error", e)
            toast.error("An error occurred while updating the stage")
        } finally {
            setUpdatingId(null)
        }
    }

    if (candidates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                    <MapPin className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">No candidates in this stage</p>
                <p className="text-xs text-muted-foreground/30 mt-1">Candidates will appear here as they progress</p>
            </div>
        )
    }

    const gridCols = readOnly
        ? "grid-cols-[1fr_220px_160px_80px]"
        : "grid-cols-[1fr_220px_100px_160px_80px]"

    return (
        <div className="space-y-1">
            {/* Column headers */}
            <div className={cn("grid gap-x-6 items-center px-5 pb-2 pt-1", gridCols)}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Candidate</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Stage</span>
                {!readOnly && <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Experience</span>}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Location</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 text-right">Links</span>
            </div>
            {candidates.map((candidate, index) => {
                const normalizedLinks = candidate.links.map(link => {
                    if (typeof link === 'string') return { url: link, type: 'Link' }
                    return link
                })

                const initials = candidate.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                const isSelected = selectedId === candidate.id
                const isUpdating = updatingId === candidate.id
                const avatarGradient = nameToColor(candidate.name)
                const exp = experienceMap?.[candidate.id]

                return (
                    <div
                        key={candidate.id}
                        onClick={() => onSelect(candidate)}
                        className={cn(
                            "group grid gap-x-6 items-center py-4 px-5 rounded-2xl cursor-pointer border",
                            "animate-fade-in-up transition-[background-color,border-color,box-shadow,transform] duration-300 ease-smooth",
                            gridCols,
                            isSelected
                                ? "bg-card border-border/40 shadow-sm ring-1 ring-primary/10"
                                : "bg-card/40 border-transparent hover:bg-card hover:border-border/30 hover:shadow-sm"
                        )}
                        style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
                    >
                        {/* Avatar + Info */}
                        <div className="flex items-center gap-4 min-w-0">
                            <Avatar className="h-10 w-10 rounded-xl border-0 shrink-0">
                                <AvatarFallback className={cn("bg-gradient-to-br text-foreground/70 font-bold text-[11px] rounded-xl", avatarGradient)}>
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold tracking-tight text-foreground truncate">
                                        {candidate.name}
                                    </h3>
                                    {candidate.archivedAt && (
                                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold py-0 h-4 border-destructive/20 text-destructive/70 bg-destructive/5 rounded-md">
                                            Archived
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                    {candidate.headline || "No headline"}
                                </p>
                            </div>
                        </div>

                        {/* Stage */}
                        {readOnly ? (
                            <div className="shrink-0">
                                <div className="h-7 px-3 py-0 border border-border/30 bg-muted/20 rounded-lg text-[9px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-peach shrink-0" />
                                    <span className="truncate">{candidate.stage}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Select
                                    disabled={isUpdating}
                                    onValueChange={(value) => handleUpdateStage(candidate.id, value)}
                                    defaultValue={stages?.find(s => s.text === candidate.stage)?.id}
                                >
                                    <SelectTrigger className="h-7 w-full px-3 py-0 border border-border/30 bg-muted/20 shadow-none rounded-lg text-[9px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors duration-200 justify-start gap-2">
                                        {isUpdating ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-peach shrink-0" />
                                                <SelectValue placeholder={candidate.stage} />
                                            </>
                                        )}
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/40 shadow-2xl bg-background/95 backdrop-blur-md">
                                        {stages?.map((stage) => (
                                            <SelectItem
                                                key={stage.id}
                                                value={stage.id}
                                                className="text-[10px] font-bold uppercase tracking-wider focus:bg-primary/5 focus:text-primary rounded-lg my-0.5 mx-1"
                                            >
                                                {stage.text}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Experience (hidden in readOnly mode) */}
                        {!readOnly && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                {experienceLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/30" />
                                ) : exp ? (
                                    <div className="flex items-center gap-1.5" title={exp.summary}>
                                        <Briefcase className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                        <span className="text-xs font-bold tabular-nums text-foreground">
                                            {exp.relevantYears} yr
                                        </span>
                                        {exp.totalYears > exp.relevantYears && (
                                            <span className="text-[10px] text-muted-foreground/40">
                                                / {exp.totalYears}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground/30">—</span>
                                )}
                            </div>
                        )}

                        {/* Location */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/60 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{candidate.location && typeof candidate.location === 'string' ? candidate.location : "Remote"}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 justify-end">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {normalizedLinks.map((link, i) => {
                                    let hostname = ''
                                    try { hostname = new URL(link.url).hostname.replace('www.', '') } catch {}
                                    return (
                                        <a
                                            key={i}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors duration-200"
                                            title={hostname}
                                        >
                                            <img src={`https://www.google.com/s2/favicons?sz=32&domain=${hostname}`} alt={hostname} className="w-3.5 h-3.5 rounded-sm" />
                                        </a>
                                    )
                                })}
                            </div>
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-[color,transform] duration-300 ease-smooth",
                                isSelected ? "text-primary" : "text-muted-foreground/15 group-hover:text-muted-foreground/40 group-hover:translate-x-0.5"
                            )} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
