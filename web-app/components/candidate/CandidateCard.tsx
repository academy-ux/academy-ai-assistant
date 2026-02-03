import { ExternalLink, MapPin, Briefcase, FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface Candidate {
    id: string
    name: string
    headline: string
    location: string
    email: string
    links: string[] | { type?: string; url: string }[]
    position: string
    stage: string
    createdAt: number
    description?: string
    archivedAt?: number | null
    archivedReason?: string | null
}

interface CandidateCardProps {
    candidate: Candidate
}

export function CandidateCard({ candidate }: CandidateCardProps) {
    // Normalize links
    const normalizedLinks = candidate.links.map(link => {
        if (typeof link === 'string') return { url: link, type: 'Link' }
        return link
    })

    const linkedIn = normalizedLinks.find(l => l.url.includes('linkedin.com') || l.type?.toLowerCase().includes('linkedin'))
    const portfolio = normalizedLinks.find(l => !l.url.includes('linkedin.com') && (l.type?.toLowerCase().includes('portfolio') || l.type?.toLowerCase().includes('personal') || l.type?.toLowerCase().includes('website')))

    // Extract experience years from headline if possible (simple heuristic)
    const expMatch = candidate.headline.match(/(\d+)\+?\s*(?:years|yrs)/i)
    const exp = expMatch ? `${expMatch[1]}+` : null

    return (
        <Card className="p-6 transition-all duration-200 hover:shadow-lg hover:border-primary/20 group relative overflow-hidden bg-background">
            <div className="flex flex-col gap-4">
                {/* Header */}
                <div>
                    <h3 className="text-xl font-bold tracking-tight mb-1 group-hover:text-primary transition-colors">
                        {candidate.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        {candidate.location && typeof candidate.location === 'string' && (
                            <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {candidate.location}
                            </div>
                        )}
                        {exp && (
                            <Badge variant="outline" className="h-5 px-1.5 text-xs font-normal">
                                Exp: {exp}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Headline/Description */}
                <div className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {candidate.headline || candidate.description || "No description available."}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-3 pt-2 mt-auto">
                    {linkedIn && (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium" asChild>
                            <a href={linkedIn.url} target="_blank" rel="noopener noreferrer">
                                <span className="font-semibold">LI</span> LinkedIn
                            </a>
                        </Button>
                    )}
                    {portfolio && (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium" asChild>
                            <a href={portfolio.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Portfolio
                            </a>
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}
