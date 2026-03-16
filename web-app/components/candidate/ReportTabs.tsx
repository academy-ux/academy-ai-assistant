"use client"

import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

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
        <div className={cn("flex gap-0.5 md:gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1", ClassName)}>
            {options.map((option) => {
                const isActive = activeTab === option.value
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange?.(option.value)}
                        className={cn(
                            "relative px-3 md:px-4 py-3 text-[10px] md:text-[11px] font-bold tracking-wide whitespace-nowrap flex items-center gap-1.5 md:gap-2 transition-colors duration-200",
                            isActive
                                ? "text-foreground"
                                : "text-muted-foreground/50 hover:text-foreground/70"
                        )}
                    >
                        <span>{option.label}</span>
                        {option.count !== undefined && option.count > 0 && (
                            <span className={cn(
                                "h-[18px] min-w-[18px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums transition-colors duration-200",
                                isActive
                                    ? "bg-peach/80 text-foreground"
                                    : "bg-muted/40 text-muted-foreground/50"
                            )}>
                                {option.count}
                            </span>
                        )}
                        {isActive && (
                            <motion.div
                                layoutId="tab-indicator"
                                className="absolute bottom-0 left-2 right-2 h-[2px] bg-foreground rounded-full"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                    </button>
                )
            })}
        </div>
    )
}
