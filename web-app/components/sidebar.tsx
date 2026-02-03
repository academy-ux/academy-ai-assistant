'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, History, MessageSquare, LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
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

export function Sidebar() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentTab = searchParams.get('tab')
    const { data: session } = useSession()

    // Helper for active state
    const isActive = (path: string, tab?: string) => {
        if (pathname !== path) return false
        if (!tab) return !currentTab || currentTab !== 'ask' // Default to meetings if no tab or tab!=ask
        return currentTab === tab
    }

    if (!session) return null // Or render a simplified sidebar for logged out? Navbar rendered "Sign In".

    return (
        <aside className="w-[260px] flex-col border-r border-border/40 bg-card/30 hidden md:flex h-full flex-shrink-0 z-50">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-border/40 flex-shrink-0">
                <Link href="/" className="flex items-center gap-3 group">
                    <Image
                        src="/academy-logo-2024-v1.svg"
                        width={100}
                        height={24}
                        alt="Academy"
                        className="h-5 w-auto transition-opacity group-hover:opacity-80"
                    />
                    <span className="text-xs text-muted-foreground tracking-wide border-l border-border pl-3 ml-1">AI Assistant</span>
                </Link>
            </div>

            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                <div className="pt-2 pb-2">
                    <h4 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Workspace</h4>
                    <Link href="/history">
                        <Button variant="ghost" className={cn("w-full justify-start gap-3 font-medium", isActive('/history') && "bg-primary/10 text-primary")}>
                            <History size={18} className={cn(isActive('/history') ? "text-primary" : "text-muted-foreground")} />
                            Meetings
                        </Button>
                    </Link>
                    <Link href="/history?tab=ask">
                        <Button variant="ghost" className={cn("w-full justify-start gap-3 font-medium", isActive('/history', 'ask') && "bg-primary/10 text-primary")}>
                            <Sparkles size={18} className={cn(isActive('/history', 'ask') ? "text-primary" : "text-muted-foreground")} />
                            Ask AI
                        </Button>
                    </Link>
                    <Link href="/feedback">
                        <Button variant="ghost" className={cn("w-full justify-start gap-3 font-medium", pathname === '/feedback' && "bg-muted")}>
                            <MessageSquare size={18} className="text-muted-foreground" />
                            Feedback
                        </Button>
                    </Link>
                </div>
            </div>

            {/* User Profile */}
            <div className="p-4 border-t border-border/40 bg-card/20 flex-shrink-0">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <Avatar className="h-9 w-9 border border-border/40">
                        <AvatarImage
                            src={session.user?.image || undefined}
                            alt={session.user?.name || 'User'}
                        />
                        <AvatarFallback className="text-xs font-semibold bg-muted/50 text-foreground/70">
                            {initialsFrom(session.user?.name || session.user?.email || '')}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground/90 truncate">
                            {session.user?.name || 'Account'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                            {session.user?.email}
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                    size="sm"
                    onClick={() => signOut()}
                >
                    <LogOut size={14} />
                    Sign Out
                </Button>
            </div>
        </aside>
    )
}
