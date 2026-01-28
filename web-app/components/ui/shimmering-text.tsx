"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ShimmeringTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  shimmerWidth?: number
  shimmerColor?: string
}

const ShimmeringText = React.forwardRef<HTMLSpanElement, ShimmeringTextProps>(
  ({ children, shimmerWidth = 100, shimmerColor, className, style, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-block bg-clip-text text-transparent",
          "bg-gradient-to-r from-foreground via-foreground/50 to-foreground",
          "bg-[length:200%_100%]",
          "animate-shimmer",
          className
        )}
        style={{
          ...style,
          backgroundSize: `${shimmerWidth * 2}% 100%`,
        }}
        {...props}
      >
        {children}
      </span>
    )
  }
)
ShimmeringText.displayName = "ShimmeringText"

export { ShimmeringText }
