"use client"

import * as React from "react"
import { motion, useInView } from "motion/react"
import { cn } from "@/lib/utils"

interface ShimmeringTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string
  duration?: number
  delay?: number
  repeat?: boolean
  repeatDelay?: number
  startOnView?: boolean
  once?: boolean
  inViewMargin?: string
  spread?: number
  color?: string
  shimmerColor?: string
}

const ShimmeringText = React.forwardRef<HTMLDivElement, ShimmeringTextProps>(
  (
    {
      text,
      duration = 2,
      delay = 0,
      repeat = true,
      repeatDelay = 0.5,
      className,
      startOnView = true,
      once = false,
      inViewMargin,
      spread = 2,
      color,
      shimmerColor,
      ...props
    },
    ref
  ) => {
    const localRef = React.useRef<HTMLDivElement>(null)
    const isInView = useInView(localRef, {
      once,
      margin: inViewMargin as any,
    })

    const shouldAnimate = startOnView ? isInView : true

    const spreadValue = React.useMemo(() => {
      const baseSpread = 100
      const length = text.length
      return baseSpread + length * spread
    }, [text.length, spread])

    const animationProps = React.useMemo(() => {
      if (repeat) {
        return {
          backgroundPosition: ["0% 50%", `${spreadValue}% 50%`],
          transition: {
            delay,
            duration,
            repeat: Infinity,
            repeatDelay,
            ease: "linear" as any,
          },
        }
      }

      return {
        backgroundPosition: shouldAnimate
          ? ["0% 50%", `${spreadValue}% 50%`]
          : "0% 50%",
        transition: {
          delay,
          duration,
          ease: "easeInOut" as any,
        },
      }
    }, [repeat, shouldAnimate, spreadValue, delay, duration, repeatDelay])

    return (
      <div
        ref={(node) => {
          if (typeof ref === "function") {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
          // @ts-ignore
          localRef.current = node
        }}
        className={cn("inline-block", className)}
        {...props}
      >
        <motion.span
          className="inline-block bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-clip-text text-transparent"
          style={{
            backgroundSize: "200% auto",
            ...(color && { "--base-color": color }),
            ...(shimmerColor && { "--shimmer-color": shimmerColor }),
          }}
          animate={animationProps}
        >
          {text}
        </motion.span>
      </div>
    )
  }
)

ShimmeringText.displayName = "ShimmeringText"

export { ShimmeringText }
