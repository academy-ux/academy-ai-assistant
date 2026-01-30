'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { MessageSquare, Search, Trash2, Plus, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: { id: string; candidateName: string }[]
}

interface Conversation {
  id: string
  user_email: string
  user_name: string | null
  interview_id: string | null
  title: string
  messages: ConversationMessage[]
  message_count: number
  created_at: string
  updated_at: string
  last_message_at: string
}

interface ConversationsSidebarProps {
  interviewId?: string | null
  currentConversationId?: string | null
  onSelectConversation: (conversation: Conversation) => void
  onNewConversation: () => void
}

export function ConversationsSidebar({
  interviewId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationsSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      loadConversations()
    }
  }, [open, interviewId])

  useEffect(() => {
    // Filter conversations based on search
    if (search.trim()) {
      const lowerSearch = search.toLowerCase()
      const filtered = conversations.filter(
        (conv) =>
          conv.title.toLowerCase().includes(lowerSearch) ||
          conv.messages.some((msg) =>
            msg.content.toLowerCase().includes(lowerSearch)
          )
      )
      setFilteredConversations(filtered)
    } else {
      setFilteredConversations(conversations)
    }
  }, [search, conversations])

  async function loadConversations() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (interviewId) {
        params.set('interview_id', interviewId)
      } else {
        params.set('interview_id', 'null') // Global conversations only
      }

      const res = await fetch(`/api/conversations?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load conversations')

      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast.error('Failed to load conversation history')
    } finally {
      setLoading(false)
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()

    if (!confirm('Delete this conversation? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete')

      setConversations((prev) => prev.filter((c) => c.id !== id))
      toast.success('Conversation deleted')
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-border/50 hover:bg-muted/50 hover:border-border shadow-sm hover:shadow transition-all h-9 px-3.5 rounded-lg"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-sm font-medium">
            {conversations.length > 0 ? `${conversations.length} Saved` : 'History'}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border/30 bg-background/95 backdrop-blur-sm">
          <SheetTitle className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight">Conversation History</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onNewConversation()
                setOpen(false)
              }}
              className="gap-1.5 h-8 px-3 hover:bg-muted/50 rounded-lg transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">New</span>
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              type="search"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-background border-border/50 focus-visible:border-border shadow-sm rounded-lg transition-all"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin-medium" />
                  <p className="text-sm text-muted-foreground font-medium">Loading conversations...</p>
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="mb-4 h-14 w-14 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center">
                  <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-foreground mb-1.5">
                  {search.trim()
                    ? 'No conversations found'
                    : 'No saved conversations yet'}
                </h3>
                <p className="text-sm text-muted-foreground/80 max-w-[280px]">
                  {search.trim()
                    ? 'Try adjusting your search terms'
                    : 'Your conversations will be saved here automatically'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv, index) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    onSelectConversation(conv)
                    setOpen(false)
                  }}
                  className={cn(
                    'group w-full text-left p-4 rounded-xl border transition-all duration-200',
                    'hover:shadow-md hover:-translate-y-0.5',
                    currentConversationId === conv.id
                      ? 'bg-primary/8 border-primary/30 shadow-sm ring-1 ring-primary/10'
                      : 'bg-background border-border/40 hover:bg-muted/30 hover:border-border/60'
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h4 className="text-[13px] font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
                      {conv.title}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="shrink-0 p-1.5 hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </div>

                  {conv.messages.length > 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground/80 line-clamp-2 mb-3">
                      {conv.messages[0].content}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 font-medium">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(conv.last_message_at)}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
