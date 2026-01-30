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
          className="gap-2 border-border/60 hover:bg-muted/50"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">
            {conversations.length > 0 ? `${conversations.length} Saved` : 'History'}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-[400px] p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40">
          <SheetTitle className="flex items-center justify-between">
            <span>Conversation History</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onNewConversation()
                setOpen(false)
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="px-6 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Loading...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? 'No conversations found'
                    : 'No saved conversations yet'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Conversations are saved automatically
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-all duration-200',
                    'hover:bg-muted/50 hover:border-border/60',
                    currentConversationId === conv.id
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-card/30 border-border/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                      {conv.title}
                    </h4>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="shrink-0 p-1 hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>

                  {conv.messages.length > 0 && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {conv.messages[0].content}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(conv.last_message_at)}</span>
                    <span>•</span>
                    <span>{conv.message_count} messages</span>
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
