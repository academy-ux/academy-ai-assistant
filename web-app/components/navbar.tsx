'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 max-w-[1600px] items-center justify-between px-6 mx-auto">
        <Link href="/" className="flex items-center gap-4">
          <Image 
            src="/academy-logo-2024-v1.svg" 
            alt="Academy UX" 
            width={100}
            height={24}
            className="h-5 w-auto"
            priority
          />
          <span className="text-foreground/30 font-light hidden sm:inline-block">|</span>
          <span className="text-foreground/60 hidden sm:inline-block text-sm tracking-wide">
            AI Assistant
          </span>
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
            className="rounded-none border-foreground/20 hover:bg-foreground hover:text-background transition-colors"
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
