"use client"

import { Candidate } from "./CandidateCard"
import { Globe, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface SharedCandidateDetailsProps {
    candidate: Candidate
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

export function SharedCandidateDetails({ candidate }: SharedCandidateDetailsProps) {
    const normalizedLinks = candidate.links?.map(link => {
        if (typeof link === 'string') return { url: link, type: 'Link' }
        return link
    }) || []

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

    const avatarGradient = nameToColor(candidate.name)
    const initials = candidate.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

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
                </div>

                {/* Links */}
                <div className="flex items-center gap-2 flex-wrap">
                    {normalizedLinks.map((link, i) => {
                        const info = getLinkInfo(link.url)
                        return (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-200">
                                {info.icon} {info.label}
                            </a>
                        )
                    })}
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-muted/20 rounded-xl p-5">
                <div className="space-y-3">
                    {[
                        { label: "Location", value: candidate.location || "Remote" },
                        { label: "Stage", value: candidate.stage },
                        { label: "Position", value: candidate.position },
                        ...(candidate.createdAt ? [{
                            label: "Applied",
                            value: new Date(candidate.createdAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                            })
                        }] : []),
                    ].filter(item => item.value).map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{item.label}</span>
                            <span className="text-sm font-bold tracking-tight truncate max-w-[200px]">{item.value}</span>
                        </div>
                    ))}
                </div>
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
