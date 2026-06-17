"use client"

import { useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { resolveLogoDomain, faviconUrl } from "@/lib/logo"

interface ClientLogoProps {
    team?: string | null
    size?: number
    className?: string
}

/**
 * Client logo pulled from the company website's favicon (resolved from the
 * team/company name). Falls back to a building glyph when there's no team or
 * the favicon fails to load.
 */
export function ClientLogo({ team, size = 28, className }: ClientLogoProps) {
    const [errored, setErrored] = useState(false)
    const [domain, setDomain] = useState(() => (team ? resolveLogoDomain(team) : ""))

    useEffect(() => {
        setErrored(false)
        setDomain(team ? resolveLogoDomain(team) : "")
    }, [team])

    if (!team || !domain || errored) {
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
            src={faviconUrl(domain, 256)}
            alt={`${team} logo`}
            width={size}
            height={size}
            className={cn("rounded-xl object-contain bg-white/60 shrink-0", className)}
            style={{ width: size, height: size }}
            onError={() => setErrored(true)}
        />
    )
}
