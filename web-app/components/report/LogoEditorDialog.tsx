"use client"

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, Loader2, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    faviconUrl,
    fetchLogoMap,
    logoDevUrl,
    teamToDomain,
    type LogoConfig,
    type LogoSource,
} from '@/lib/logo'

interface LogoEditorDialogProps {
    team: string
    open: boolean
    onOpenChange: (open: boolean) => void
    cfg: LogoConfig | null
    onSaved: (cfg: LogoConfig) => void
}

function Preview({ src, size = 44 }: { src: string | null; size?: number }) {
    const [failed, setFailed] = useState(false)
    useEffect(() => { setFailed(false) }, [src])
    if (!src || failed) {
        return (
            <div className="rounded-full bg-muted flex items-center justify-center" style={{ width: size, height: size }}>
                <Building2 className="text-muted-foreground/60" style={{ width: size * 0.45, height: size * 0.45 }} />
            </div>
        )
    }
    return (
        <img
            src={src}
            alt="logo preview"
            width={size}
            height={size}
            className="rounded-full object-contain bg-white/60"
            style={{ width: size, height: size }}
            onError={() => setFailed(true)}
        />
    )
}

/**
 * Pick where a client's logo comes from: the logo.dev brand logo, the website
 * favicon, or a custom upload. The choice is saved server-side so the internal
 * views and the shared client report always show the same logo.
 */
export function LogoEditorDialog({ team, open, onOpenChange, cfg, onSaved }: LogoEditorDialogProps) {
    const [domain, setDomain] = useState('')
    const [source, setSource] = useState<LogoSource | null>(null)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [saving, setSaving] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) return
        setDomain(cfg?.domain || teamToDomain(team))
        setSource(cfg?.source || (cfg?.logoUrl ? 'upload' : 'logodev'))
        setLogoUrl(cfg?.logoUrl || null)
    }, [open, cfg, team])

    const cleanedDomain = domain.trim().toLowerCase()

    async function uploadFile(file: File) {
        setBusy(true)
        try {
            const form = new FormData()
            form.set('team', team)
            form.set('file', file)
            const res = await fetch('/api/logos', { method: 'POST', body: form })
            const body = await res.json()
            if (res.ok && body.logoUrl) {
                setLogoUrl(body.logoUrl)
                setSource('upload')
            } else {
                alert(body.error || 'Upload failed')
            }
        } catch {
            alert('Upload failed')
        } finally {
            setBusy(false)
        }
    }

    async function removeUpload() {
        setBusy(true)
        try {
            await fetch('/api/logos', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team }),
            })
            setLogoUrl(null)
            if (source === 'upload') setSource('logodev')
        } finally {
            setBusy(false)
        }
    }

    async function save() {
        setSaving(true)
        try {
            const chosen = source === 'upload' && !logoUrl ? null : source
            const res = await fetch('/api/logos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team, domain: cleanedDomain, source: chosen }),
            })
            if (!res.ok) throw new Error(await res.text())
            const next: LogoConfig = { domain: cleanedDomain || null, logoUrl, source: chosen }
            fetchLogoMap(true)
            onSaved(next)
            onOpenChange(false)
        } catch {
            alert('Could not save logo settings')
        } finally {
            setSaving(false)
        }
    }

    const options: { key: LogoSource; label: string; hint: string; preview: string | null }[] = [
        { key: 'logodev', label: 'Brand logo', hint: 'From logo.dev', preview: cleanedDomain ? logoDevUrl(cleanedDomain) : null },
        { key: 'favicon', label: 'Website favicon', hint: `From ${cleanedDomain || 'their site'}`, preview: cleanedDomain ? faviconUrl(cleanedDomain, 256) : null },
        { key: 'upload', label: 'Custom upload', hint: logoUrl ? 'Uploaded logo' : 'PNG, JPG, SVG or WebP', preview: logoUrl },
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" onClick={e => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle className="text-base">Logo · {team}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                            Company website domain
                        </label>
                        <input
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            placeholder="company.com"
                            className="w-full h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {options.map(opt => {
                            const selected = source === opt.key
                            const disabled = opt.key !== 'upload' && !cleanedDomain
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        if (opt.key === 'upload' && !logoUrl) fileRef.current?.click()
                                        else setSource(opt.key)
                                    }}
                                    className={cn(
                                        'relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
                                        selected ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40',
                                        disabled && 'opacity-40 cursor-not-allowed'
                                    )}
                                >
                                    {selected && (
                                        <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5" />
                                        </span>
                                    )}
                                    {opt.key === 'upload' && !logoUrl ? (
                                        <div className="rounded-full bg-muted flex items-center justify-center" style={{ width: 44, height: 44 }}>
                                            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    ) : (
                                        <Preview src={opt.preview} />
                                    )}
                                    <div>
                                        <div className="text-xs font-medium text-foreground">{opt.label}</div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[110px]">{opt.hint}</div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {logoUrl && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}>
                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                Replace upload
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" disabled={busy} onClick={removeUpload}>
                                <Trash2 className="h-3 w-3" />
                                Remove upload
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" size="sm" disabled={saving} onClick={save}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                        </Button>
                    </div>
                </div>

                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
                />
            </DialogContent>
        </Dialog>
    )
}
