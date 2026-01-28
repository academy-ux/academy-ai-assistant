'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="border-b border-border/50 bg-card/20 backdrop-blur-md supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="container flex h-16 max-w-[1600px] items-center justify-between px-6 mx-auto">
        <Link href="/" className="flex items-center gap-4 group">
          <Image 
            src="/academy-logo-2024-v1.svg" 
            alt="Academy UX" 
            width={100}
            height={24}
            className="h-5 w-auto transition-opacity group-hover:opacity-80"
            priority
          />
          <span className="text-border font-light hidden sm:inline-block">|</span>
          <span className="text-muted-foreground hidden sm:inline-block text-sm tracking-wide">
            AI Assistant
          </span>
        </Link>
        
        <div className="flex items-center space-x-1">
          {session ? (
            <>
              <Link 
                href="/history" 
                className="text-xs font-medium px-3 py-2 rounded-lg transition-colors text-foreground/70 hover:text-foreground hover:bg-accent"
              >
                History
              </Link>
              <Link 
                href="/feedback" 
                className="text-xs font-medium px-3 py-2 rounded-lg transition-colors text-foreground/70 hover:text-foreground hover:bg-accent"
              >
                Feedback
              </Link>
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border/50">
                <span className="text-xs text-muted-foreground hidden md:inline-block">
                  {session.user?.email}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => signOut()}
                  className="text-xs"
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Link 
              href="/" 
              className="text-sm font-medium px-3 py-2 rounded-lg transition-colors text-foreground/70 hover:text-foreground hover:bg-accent"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
