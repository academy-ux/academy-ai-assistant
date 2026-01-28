"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: "user" | "assistant"
}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ from, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group flex gap-3",
          from === "user" ? "flex-row-reverse" : "flex-row",
          className
        )}
        data-from={from}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Message.displayName = "Message"

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "contained" | "flat"
}

const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ variant = "contained", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "max-w-[85%] rounded-2xl",
          variant === "contained" && [
            "px-4 py-3",
            "group-data-[from=user]:bg-peach group-data-[from=user]:text-foreground group-data-[from=user]:rounded-tr-sm",
            "group-data-[from=assistant]:bg-card/40 group-data-[from=assistant]:border group-data-[from=assistant]:border-border/40 group-data-[from=assistant]:rounded-tl-sm group-data-[from=assistant]:backdrop-blur-sm",
          ],
          variant === "flat" && [
            "group-data-[from=assistant]:bg-transparent",
          ],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
MessageContent.displayName = "MessageContent"

interface MessageAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
  src?: string
  name?: string
  fallbackClassName?: string
}

const MessageAvatar = React.forwardRef<HTMLSpanElement, MessageAvatarProps>(
  ({ src, name, className, fallbackClassName, ...props }, ref) => {
    const initials = name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?"

    return (
      <Avatar
        ref={ref}
        className={cn(
          "h-8 w-8 flex-shrink-0 ring-1 ring-border",
          className
        )}
        {...props}
      >
        {src && <AvatarImage src={src} alt={name || "Avatar"} />}
        <AvatarFallback className={cn("text-xs", fallbackClassName)}>
          {initials}
        </AvatarFallback>
      </Avatar>
    )
  }
)
MessageAvatar.displayName = "MessageAvatar"

export { Message, MessageContent, MessageAvatar }
