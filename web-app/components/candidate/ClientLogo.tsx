"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { resolveLogoDomain, logoSources } from "@/lib/logo"

interface ClientLogoProps {
    team?: string | null
    size?: number
    className?: string
}

/**
 * Client logo for a company/team name. Tries the crisp logo.dev brand logo
 * first, falls back to the website favicon, then a building glyph.
 */
export function ClientLogo({ team, size = 28, className }: ClientLogoProps) {
    const sources = useMemo(() => (team ? logoSources(resolveLogoDomain(team)) : []), [team])
    const [idx, setIdx] = useState(0)

    useEffect(() => { setIdx(0) }, [team])

    const current = sources[idx]

    if (!team || !current) {
        return (
            <div
                className={cn("rounded-xl bg-muted flex items-center justify-center shrink-0", className)}
                style={{ width: size, height: size }}
            >
                <Building2 className="text-muted-foreground/60" style={{ width: size * 0.45, height: size * 0.45 }} />
            </div>
        )
    }

    return (
        <img
            src={current}
            alt={`${team} logo`}
            width={size}
            height={size}
            className={cn("rounded-xl object-contain bg-white/60 shrink-0", className)}
            style={{ width: size, height: size }}
            onError={() => setIdx(i => i + 1)}
        />
    )
}
