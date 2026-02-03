import { Candidate, CandidateCard } from './CandidateCard'
import { cn } from '@/lib/utils'

interface CandidateStageColumnProps {
    title: string
    candidates: Candidate[]
    className?: string
    emptyMessage?: string
}

export function CandidateStageColumn({
    title,
    candidates,
    className,
    emptyMessage = "No candidates in this stage."
}: CandidateStageColumnProps) {
    return (
        <div className={cn("space-y-6", className)}>
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                <span className="text-sm text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                    {candidates.length}
                </span>
            </div>

            {candidates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {candidates.map((candidate) => (
                        <CandidateCard key={candidate.id} candidate={candidate} />
                    ))}
                </div>
            ) : (
                <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
                    {emptyMessage}
                </div>
            )}
        </div>
    )
}
