"use client"

import * as React from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ConversationProps extends React.ComponentPropsWithoutRef<typeof StickToBottom> {
  className?: string
  initial?: "smooth" | "auto" | "instant"
  resize?: "smooth" | "auto" | "instant"
}

const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, initial = "smooth", resize = "smooth", children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative flex flex-col overflow-hidden", className)}>
        <StickToBottom
          initial={initial}
          resize={resize}
          {...props}
        >
          {children}
        </StickToBottom>
      </div>
    )
  }
)
Conversation.displayName = "Conversation"

interface ConversationContentProps
  extends React.ComponentPropsWithoutRef<typeof StickToBottom.Content> {
  className?: string
}

const ConversationContent = React.forwardRef<HTMLDivElement, ConversationContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex-1 overflow-y-auto", className)}>
        <StickToBottom.Content
          {...props}
        >
          {children}
        </StickToBottom.Content>
      </div>
    )
  }
)
ConversationContent.displayName = "ConversationContent"

interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: React.ReactNode
}

const ConversationEmptyState = React.forwardRef<HTMLDivElement, ConversationEmptyStateProps>(
  ({ title = "No messages yet", description, icon, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-3 text-center py-12 px-4",
          className
        )}
        {...props}
      >
        {children || (
          <>
            {icon && <div className="mb-2">{icon}</div>}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground font-light">{description}</p>
              )}
            </div>
          </>
        )}
      </div>
    )
  }
)
ConversationEmptyState.displayName = "ConversationEmptyState"

interface ConversationScrollButtonProps
  extends React.ComponentPropsWithoutRef<typeof Button> {
  className?: string
}

const ConversationScrollButton = React.forwardRef<
  HTMLButtonElement,
  ConversationScrollButtonProps
>(({ className, ...props }, ref) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  if (isAtBottom) return null

  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-lg bg-card/80 backdrop-blur-sm border-border/60 hover:bg-card transition-opacity duration-200",
        className
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </Button>
  )
})
ConversationScrollButton.displayName = "ConversationScrollButton"

export { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton }
