"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type AgentState = null | "thinking" | "listening" | "talking"

interface OrbProps extends React.HTMLAttributes<HTMLDivElement> {
  colors?: [string, string]
  agentState?: AgentState
  size?: "sm" | "md" | "lg"
}

const Orb = React.forwardRef<HTMLDivElement, OrbProps>(
  ({ colors = ["#CADCFC", "#A0B9D1"], agentState = null, size = "md", className, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-12 w-12",
      lg: "h-16 w-16"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-full overflow-hidden",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Gradient background */}
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-br",
            agentState === "talking" && "animate-pulse",
            agentState === "thinking" && "animate-spin-slow",
            agentState === "listening" && "animate-bounce-subtle"
          )}
          style={{
            background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`
          }}
        />
        
        {/* Inner glow */}
        <div
          className={cn(
            "absolute inset-1 rounded-full",
            "bg-gradient-to-br from-white/40 to-transparent"
          )}
        />
        
        {/* Animated ring for active states */}
        {agentState && (
          <div
            className={cn(
              "absolute inset-0 rounded-full",
              "border-2 border-white/30",
              agentState === "talking" && "animate-ping",
              agentState === "thinking" && "animate-pulse",
              agentState === "listening" && "animate-pulse"
            )}
            style={{ animationDuration: "2s" }}
          />
        )}
        
        {/* Center highlight */}
        <div
          className="absolute top-1/4 left-1/4 w-1/4 h-1/4 rounded-full bg-white/50 blur-sm"
        />
      </div>
    )
  }
)
Orb.displayName = "Orb"

export { Orb }
