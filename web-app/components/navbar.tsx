'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function initialsFrom(label: string) {
  const parts = (label || 'U')
    .trim()
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
  return parts.map((p) => p[0]!.toUpperCase()).join('') || 'U'
}

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="border-b border-border/50 bg-card/20 backdrop-blur-md supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="flex h-16 max-w-[1600px] items-center justify-between px-6 mx-auto w-full">
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
                <div className="hidden md:flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-border/40">
                    <AvatarImage
                      src={session.user?.image || undefined}
                      alt={session.user?.name || 'User'}
                    />
                    <AvatarFallback className="text-[10px] font-semibold bg-muted/50 text-foreground/70">
                      {initialsFrom(session.user?.name || session.user?.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-medium text-foreground/80 max-w-[180px] truncate">
                      {session.user?.name || 'Account'}
                    </span>
                    <span className="text-[11px] text-muted-foreground max-w-[220px] truncate">
                      {session.user?.email}
                    </span>
                  </div>
                </div>
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
