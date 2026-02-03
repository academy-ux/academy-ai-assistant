"use client"

import { cn } from '@/lib/utils'

interface TabOption {
    value: string
    label: string
    count?: number
}

interface ReportTabsProps {
    defaultValue: string
    options: TabOption[]
    onChange?: (value: string) => void
    ClassName?: string
    activeTab: string
}

export function ReportTabs({ options, onChange, ClassName, activeTab }: ReportTabsProps) {
    return (
        <div className={cn("flex gap-2 overflow-x-auto pb-4 scrollbar-hide", ClassName)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange?.(option.value)}
                    className={cn(
                        "px-4 py-1.5 text-[10px] rounded-full transition-all font-bold whitespace-nowrap flex items-center gap-2 border",
                        activeTab === option.value
                            ? "bg-peach text-foreground border-peach/50 shadow-sm"
                            : "bg-card/40 text-muted-foreground/50 hover:bg-card/60 hover:text-foreground border-border/20"
                    )}
                >
                    <span className="uppercase tracking-[0.2em]">{option.label}</span>
                    {option.count !== undefined && (
                        <span className={cn(
                            "h-4 min-w-[1rem] px-1 rounded-full flex items-center justify-center text-[9px] font-black transition-all",
                            activeTab === option.value
                                ? "bg-foreground/10 text-foreground"
                                : "bg-muted/30 text-muted-foreground/40"
                        )}>
                            {option.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
