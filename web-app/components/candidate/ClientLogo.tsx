"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchLogoMap, logoSourcesFor, teamKey, type LogoConfig } from "@/lib/logo"

interface ClientLogoProps {
    team?: string | null
    size?: number
    className?: string
}

/**
 * Client logo for a company/team name. An uploaded custom logo (client_logos
 * table) wins; otherwise the crisp logo.dev brand logo, then the website
 * favicon, then a building glyph.
 */
export function ClientLogo({ team, size = 28, className }: ClientLogoProps) {
    const [cfg, setCfg] = useState<LogoConfig | null>(null)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        let alive = true
        fetchLogoMap().then((map) => {
            if (!alive) return
            setCfg(team ? map[teamKey(team)] || null : null)
            setLoaded(true)
        })
        return () => { alive = false }
    }, [team])

    const sources = useMemo(() => (team && loaded ? logoSourcesFor(team, cfg) : []), [team, cfg, loaded])
    const [idx, setIdx] = useState(0)

    useEffect(() => { setIdx(0) }, [team, cfg, loaded])

    const current = sources[idx]

    if (!team || !current) {
        return (
            <div
                className={cn("rounded-full bg-muted flex items-center justify-center shrink-0", className)}
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
            className={cn("rounded-full object-contain bg-white/60 shrink-0", className)}
            style={{ width: size, height: size }}
            onError={() => setIdx(i => i + 1)}
        />
    )
}
