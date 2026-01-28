"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Streamdown } from "streamdown"

interface ResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

const Response = React.memo(function Response({
  children,
  className,
  ...props
}: ResponseProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-p:leading-relaxed prose-p:my-2",
        "prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4",
        "prose-ul:my-2 prose-ol:my-2",
        "prose-li:my-0.5",
        "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Streamdown>{children}</Streamdown>
      ) : (
        children
      )}
    </div>
  )
})

Response.displayName = "Response"

export { Response }
