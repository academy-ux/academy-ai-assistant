"use client"

import { Badge } from "@/components/ui/badge"
import { MapPin, ChevronRight, Mail, Linkedin, Globe, Loader2 } from "lucide-react"
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

interface CandidateTableProps {
    candidates: Candidate[]
    onSelect: (candidate: Candidate) => void
    selectedId?: string
    stages?: { id: string, text: string }[]
    onRefresh?: () => void
}

export function CandidateTable({ candidates, onSelect, selectedId, stages, onRefresh }: CandidateTableProps) {
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
            <div className="flex flex-col items-center justify-center py-32 border-t border-border/20 mt-10">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/40">No candidates in this stage</p>
            </div>
        )
    }

    return (
        <div className="divide-y divide-border/20 border-t border-border/20">
            {candidates.map((candidate) => {
                const normalizedLinks = candidate.links.map(link => {
                    if (typeof link === 'string') return { url: link, type: 'Link' }
                    return link
                })
                const linkedIn = normalizedLinks.find(l => l.url.toLowerCase().includes('linkedin.com'))
                const portfolio = normalizedLinks.find(l => !l.url.toLowerCase().includes('linkedin.com'))

                const initials = candidate.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                const isSelected = selectedId === candidate.id
                const isUpdating = updatingId === candidate.id

                return (
                    <div
                        key={candidate.id}
                        onClick={() => onSelect(candidate)}
                        className={cn(
                            "group flex flex-col md:flex-row gap-8 items-start md:items-center py-8 px-4 transition-all duration-300 cursor-pointer",
                            isSelected ? "bg-primary/[0.03]" : "hover:bg-muted/30"
                        )}
                    >
                        {/* Candidate Header / Info */}
                        <div className="flex items-center gap-5 w-80 lg:w-96 min-w-0">
                            <Avatar className="h-10 w-10 rounded-full border border-border/10">
                                <AvatarFallback className="bg-muted/50 text-muted-foreground font-medium text-xs">{initials}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold tracking-tight text-foreground truncate">
                                        {candidate.name}
                                    </h3>
                                    {candidate.archivedAt && (
                                        <Badge variant="outline" className="text-[8px] uppercase tracking-widest font-black py-0 h-3.5 border-destructive/20 text-destructive bg-destructive/[0.03]">Archived</Badge>
                                    )}
                                    {(() => {
                                        const expMatch = candidate.headline.match(/(\d+)\+?\s*(?:years|yrs)/i)
                                        if (expMatch) {
                                            return (
                                                <Badge variant="outline" className="text-[8px] uppercase tracking-widest font-black py-0 h-3.5 border-primary/20 text-primary bg-primary/[0.03]">
                                                    {expMatch[1]}+ EXP
                                                </Badge>
                                            )
                                        }
                                        return null
                                    })()}
                                </div>
                                <p className="text-[11px] text-muted-foreground font-medium italic truncate opacity-60">
                                    {candidate.headline || "No headline"}
                                </p>
                            </div>
                        </div>

                        {/* Stage Selector */}
                        <div className="w-48 px-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                                disabled={isUpdating}
                                onValueChange={(value) => handleUpdateStage(candidate.id, value)}
                                defaultValue={stages?.find(s => s.text === candidate.stage)?.id}
                            >
                                <SelectTrigger className="h-auto w-fit px-0 py-0 border-none bg-transparent shadow-none focus:ring-0 text-[10px] font-black uppercase tracking-widest text-primary/80 hover:text-primary transition-colors justify-start gap-2">
                                    {isUpdating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-peach animate-pulse" />
                                            <SelectValue placeholder={candidate.stage} />
                                        </>
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/40 shadow-2xl bg-background/95 backdrop-blur-md">
                                    {stages?.map((stage) => (
                                        <SelectItem
                                            key={stage.id}
                                            value={stage.id}
                                            className="text-[10px] font-black uppercase tracking-widest focus:bg-primary/5 focus:text-primary rounded-lg my-1 mx-1"
                                        >
                                            {stage.text}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Location */}
                        <div className="w-48 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap">
                            <MapPin className="w-3 h-3 opacity-50" />
                            {candidate.location && typeof candidate.location === 'string' ? candidate.location : "Remote"}
                        </div>

                        {/* Social & Action */}
                        <div className="flex items-center gap-4 ml-auto">
                            <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                {linkedIn && (
                                    <a
                                        href={linkedIn.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground/30 hover:text-primary transition-colors"
                                    >
                                        <Linkedin className="w-3.5 h-3.5" />
                                    </a>
                                )}
                                {portfolio && (
                                    <a
                                        href={portfolio.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground/30 hover:text-primary transition-colors"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/10 group-hover:text-primary transition-all duration-300 transform group-hover:translate-x-1" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
