"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {postings.map((posting) => (
                        <Link key={posting.id} href={`/report/${posting.id}`} className="block group">
                            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/20">
                                <CardHeader>
                                    <div className="flex justify-between items-start gap-4">
                                        <CardTitle className="leading-tight group-hover:text-primary transition-colors">
                                            {posting.text}
                                        </CardTitle>
                                        {posting.count > 0 && (
                                            <Badge variant="secondary" className="shrink-0">
                                                {posting.count} candidates
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="flex flex-col gap-1 mt-2">
                                        <span>{posting.team}</span>
                                        <span>{posting.location}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-200">
                                        View Report <ArrowRight className="ml-1 w-4 h-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}

                    {postings.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No active job postings found in Lever.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
