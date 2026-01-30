import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ParsedTitleProps {
  title: string
  className?: string
  badgeClassName?: string
}

/**
 * Parses a meeting title and wraps participant names in badges
 * Example: "Adam Perlis <> Jane Doe — Interview 01/30/2026"
 * Will wrap "Adam Perlis" and "Jane Doe" in outline badges
 */
export function ParsedTitle({ title, className, badgeClassName }: ParsedTitleProps) {
  const parts = parseTitle(title)
  
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {parts.map((part, index) => {
        if (part.type === 'name') {
          return (
            <Badge 
              key={index} 
              variant="outline" 
              className={cn(
                "text-xs font-medium px-2 py-0.5 border-border/40 text-muted-foreground rounded-full",
                badgeClassName
              )}
            >
              {part.text}
            </Badge>
          )
        }
        return (
          <span key={index} className="text-xs text-muted-foreground">
            {part.text}
          </span>
        )
      })}
    </span>
  )
}

type TitlePart = {
  type: 'name' | 'separator' | 'text'
  text: string
}

function parseTitle(title: string): TitlePart[] {
  const parts: TitlePart[] = []
  
  // Common patterns in meeting titles:
  // "Name1 <> Name2 — Type Date"
  // "Name1 - Name2 @ Company"
  // Split by common separators while preserving them
  const separatorRegex = /(<>|—|–|-|@|\|)/g
  const segments = title.split(separatorRegex)
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim()
    if (!segment) continue
    
    // Check if this is a separator
    if (['<>', '—', '–', '-', '@', '|'].includes(segment)) {
      parts.push({ type: 'separator', text: ` ${segment} ` })
      continue
    }
    
    // Check if this looks like a name (contains letters and possibly spaces)
    // Names typically appear before separators or at the start
    const isLikelyName = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(segment)
    
    // Also check if the segment appears to be a date or other metadata
    const isDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(segment)
    const isType = ['Interview', 'Other', 'Meeting', 'Call', 'Phone Screen'].some(type => 
      segment.includes(type)
    )
    
    if (isLikelyName && !isDate && i < segments.length / 2) {
      // This is likely a participant name (and it's in the first half of the title)
      parts.push({ type: 'name', text: segment })
    } else {
      // This is other text (meeting type, date, etc.)
      parts.push({ type: 'text', text: segment })
    }
  }
  
  // If we didn't find any names, just return the whole title as text
  if (!parts.some(p => p.type === 'name')) {
    return [{ type: 'text', text: title }]
  }
  
  return parts
}
