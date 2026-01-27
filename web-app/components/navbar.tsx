'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-6 mx-auto">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-display text-2xl font-bold tracking-tight">Academy</span>
          <span className="text-muted-foreground hidden sm:inline-block">/ AI Assistant</span>
        </Link>
        
        <div className="flex items-center space-x-6">
          {session ? (
            <>
              <Link href="/history" className="text-sm font-medium transition-colors hover:text-primary">
                History
              </Link>
              <Link href="/feedback" className="text-sm font-medium transition-colors hover:text-primary">
                Feedback
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground hidden md:inline-block">
                  {session.user?.email}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => signOut()}
                  className="rounded-full border-primary/20 hover:bg-primary/10 hover:text-primary"
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
