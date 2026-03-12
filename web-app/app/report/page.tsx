"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight } from 'lucide-react'

interface Posting {
    id: string
    text: string
    team: string
    location: string
    state: string
    count: number
}

export default function ReportIndexPage() {
    const [postings, setPostings] = useState<Posting[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchPostings() {
            try {
                const res = await fetch('/api/lever/postings')
                if (res.ok) {
                    const data = await res.json()
                    setPostings(data.postings || [])
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchPostings()
    }, [])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Active Projects</h1>
                    <p className="text-muted-foreground mt-2">Select a project to view the candidate report.</p>
                </div>

                <div className="divide-y divide-border rounded-lg border">
                    {postings.map((posting) => (
                        <Link key={posting.id} href={`/report/${posting.id}`} className="flex items-center justify-between gap-4 px-5 py-4 group hover:bg-muted/50 transition-colors">
                            <div className="min-w-0 flex-1">
                                <div className="font-medium group-hover:text-primary transition-colors truncate">
                                    {posting.text}
                                </div>
                                <div className="text-sm text-muted-foreground mt-0.5">
                                    {posting.team} · {posting.location}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {posting.count > 0 && (
                                    <Badge variant="secondary">
                                        {posting.count} candidates
                                    </Badge>
                                )}
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </Link>
                    ))}

                    {postings.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No active job postings found in Lever.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
