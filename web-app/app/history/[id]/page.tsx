'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Calendar, User, Send, Search, Copy, Check, ClipboardList, RefreshCw } from 'lucide-react'
import { MagicWandIcon } from '@/components/icons/magic-wand'
import { VoiceRecorder } from '@/components/voice-recorder'
import { Message, MessageContent, MessageAvatar } from '@/components/ui/message'
import { Response } from '@/components/ui/response'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import { ConversationsSidebar } from '@/components/conversations-sidebar'
import { cn } from '@/lib/utils'
import { toast } from "sonner"

interface Interview {
  id: string
  candidate_name: string
  interviewer?: string
  position: string
  meeting_title: string
  meeting_type?: string | null
  meeting_date?: string
  summary?: string
  transcript: string
  created_at: string
  candidate_id?: string | null
  submitted_at?: string | null
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: { id: string; candidateName: string }[]
}

export default function InterviewDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'transcript' | 'ask'>('transcript')

  // AI Chat state
  const [aiQuestion, setAiQuestion] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchInterview(params.id as string)
    }
  }, [params.id])

  // Scroll to top when page loads or interview changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [params.id])

  // Set body overflow hidden for this page
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, asking])

  async function fetchInterview(id: string) {
    try {
      setLoading(true)
      const res = await fetch(`/api/interviews/${id}`)
      if (!res.ok) throw new Error('Interview not found')
      const data = await res.json()
      setInterview(data)
    } catch (error) {
      console.error('Failed to fetch interview:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveConversation(updatedMessages: ConversationMessage[]) {
    if (!interview) return

    try {
      // Generate title from first user message
      const firstUserMessage = updatedMessages.find(m => m.role === 'user')
      const title = firstUserMessage ? firstUserMessage.content.slice(0, 100) : 'Conversation'

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentConversationId,
          interview_id: interview.id, // Link to this specific interview
          title,
          messages: updatedMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            sources: m.sources
          }))
        })
      })

      if (!res.ok) throw new Error('Failed to save conversation')

      const data = await res.json()
      setCurrentConversationId(data.conversation.id)
    } catch (error) {
      console.error('Failed to save conversation:', error)
      // Don't show error to user - saving is automatic
    }
  }

  async function handleAskQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!aiQuestion.trim() || !interview) return

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: aiQuestion,
      timestamp: new Date()
    }

    try {
      setAsking(true)
      setMessages(prev => [...prev, userMessage])
      const currentQuestion = aiQuestion
      setAiQuestion('')

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      // Ask about this specific interview
      const res = await fetch('/api/interviews/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          history: conversationHistory,
          interviewId: interview.id // Focus on this interview
        })
      })
      const data = await res.json()

      const assistantMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        timestamp: new Date()
      }

      const updatedMessages = [...messages, userMessage, assistantMessage]
      setMessages(updatedMessages)

      // Save conversation after getting response
      await saveConversation(updatedMessages)
    } catch (error) {
      console.error('Ask failed', error)
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setAsking(false)
    }
  }

  function clearConversation() {
    setMessages([])
    setAiQuestion('')
    setCurrentConversationId(null)
  }

  function handleSelectConversation(conversation: any) {
    // Load the conversation messages
    const loadedMessages = conversation.messages.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources || [],
      timestamp: new Date(m.timestamp)
    }))
    setMessages(loadedMessages)
    setCurrentConversationId(conversation.id)
  }

  function handleNewConversation() {
    setMessages([])
    setAiQuestion('')
    setCurrentConversationId(null)
  }

  function copyTranscript() {
    if (interview?.transcript) {
      navigator.clipboard.writeText(interview.transcript)
      setCopied(true)
      toast.success("Transcript copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Parse and format transcript with speaker labels and timestamps
  function formatTranscript(text: string) {
    if (!text) return []

    // Remove Tactiq header if present
    let cleanText = text.replace(/^Transcript delivered by Tactiq\.io[\s\S]*?(?=(\*\s*\d{1,2}:\d{2}|\bTranscript\b\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}\s+[A-Za-z]))/i, '')
    cleanText = cleanText.trim()

    type TranscriptLine = { id: string; timestamp: string | null; speaker: string | null; content: string }

    // One-pass parser that supports mixed formats inside the same transcript.
    // We find every "utterance header" and take content until the next header.
    const headerRegex = new RegExp(
      [
        // * 12:34 ✅ : (rachel xie)
        String.raw`\*\s*(?<ts1>\d{1,2}:\d{2})\s*[⏰✅💡📋🎯⚡️💬🔥✨🌟📌⏱️✓]*\s*:\s*\((?<sp1>[^)]+)\)\s*`,
        // Transcript 00:00 Adam Perlis:
        String.raw`(?:\bTranscript\b\s*)?(?<ts2>\d{1,2}:\d{2})\s+(?<sp2>[^:\n]{2,60}?):\s*`,
      ].join('|'),
      'g'
    )

    const headers = Array.from(cleanText.matchAll(headerRegex))

    // If we can't find any structure, fall back to a single block.
    if (headers.length === 0) {
      return [{ id: 'line-0', timestamp: null, speaker: null, content: cleanText }]
    }

    const result: TranscriptLine[] = []

    const pushPlain = (content: string) => {
      const trimmed = content.replace(/\s+/g, ' ').trim()
      if (!trimmed) return
      result.push({
        id: `line-${result.length}`,
        timestamp: null,
        speaker: null,
        content: trimmed,
      })
    }

    // Keep any leading non-matching text as a plain paragraph
    const firstStart = headers[0]?.index ?? 0
    if (firstStart > 0) pushPlain(cleanText.slice(0, firstStart))

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      const next = headers[i + 1]

      const headerEnd = (h.index ?? 0) + h[0].length
      const contentEnd = next?.index ?? cleanText.length
      const rawContent = cleanText.slice(headerEnd, contentEnd).trim()

      const ts = h.groups?.ts1 ?? h.groups?.ts2 ?? null
      const speakerRaw = (h.groups?.sp1 ?? h.groups?.sp2 ?? '').trim()
      const speaker = speakerRaw ? speakerRaw.replace(/\s*\(chat\)\s*$/i, '').trim() : null

      // Sometimes there are stray tokens like "Highlights" between entries; keep them as plain text.
      if (!speaker || !rawContent) {
        pushPlain(rawContent)
        continue
      }

      result.push({
        id: `line-${result.length}`,
        timestamp: ts,
        speaker,
        content: rawContent,
      })
    }

    return result.length > 0 ? result : [{ id: 'line-0', timestamp: null, speaker: null, content: cleanText }]
  }

  // Highlight search matches in formatted transcript
  function highlightText(text: string, query: string) {
    if (!query.trim()) return text
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-peach/30 text-foreground px-1 rounded font-semibold">{part}</mark>
        : part
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner size={20} />
          <span>Loading interview...</span>
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-light">Interview not found</p>
        <Button variant="outline" onClick={() => router.back()} className="border-border/60 hover:bg-muted/50">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  const transcriptLines = formatTranscript(interview.transcript || 'No transcript available')
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleTranscriptLines = normalizedQuery
    ? transcriptLines.filter((line) => {
      const content = (line.content || '').toLowerCase()
      const speaker = (line.speaker || '').toLowerCase()
      const timestamp = (line.timestamp || '').toLowerCase()
      return (
        content.includes(normalizedQuery) ||
        speaker.includes(normalizedQuery) ||
        timestamp.includes(normalizedQuery)
      )
    })
    : transcriptLines

  const isInterview =
    (interview as any)?.meeting_type === 'Interview' || interview.meeting_title === 'Interview'

  const submittedAtRaw = (interview as any)?.submitted_at as string | null | undefined
  const isSubmitted = Boolean(isInterview && (submittedAtRaw || (interview as any)?.candidate_id))
  const submittedDate = isSubmitted
    ? new Date(submittedAtRaw || interview.meeting_date || interview.created_at)
    : null
  const submittedDateLabel = submittedDate
    ? submittedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const viewerLabel = session?.user?.name || session?.user?.email || interview.interviewer || ''
  const viewerInitials = (viewerLabel || 'U')
    .trim()
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

  const isViewerSpeaker = (speaker?: string | null) => {
    if (!speaker) return false
    const s = speaker.toLowerCase().trim()
    const name = session?.user?.name?.toLowerCase().trim()
    if (name) {
      // Match either full name, or first+last token containment.
      if (s === name) return true
      const tokens = name.split(/\s+/).filter(Boolean)
      const first = tokens[0]
      const last = tokens.length > 1 ? tokens[tokens.length - 1] : null
      if (first && s.includes(first) && (!last || s.includes(last))) return true
    }
    // Fallback: match email local-part token (e.g. adam.perlis)
    const emailLocal = session?.user?.email?.split('@')[0]?.toLowerCase()
    if (emailLocal && s.replace(/\s+/g, '').includes(emailLocal.replace(/[._-]/g, ''))) return true
    return false
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Header */}
        <div className={cn("sticky top-16 z-20 bg-background pt-6 pb-10 mb-0")}>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.back()}
                className={cn(
                  "inline-flex items-center gap-2 text-sm flex-shrink-0",
                  "text-muted-foreground hover:text-foreground transition-colors",
                  "rounded-full px-3 py-3",
                  "hover:bg-muted/40 border border-transparent hover:border-border/40"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>



              <div className="flex flex-col gap-1.5 min-w-0">
                <h1 className="text-sm font-medium tracking-tight text-foreground leading-tight truncate">
                  {interview.meeting_title && interview.meeting_title !== 'Interview'
                    ? interview.meeting_title
                    : interview.candidate_name || 'Unknown Candidate'}
                </h1>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {interview.meeting_type && (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium px-2.5 py-1 border-border/60 bg-peach/20 text-foreground rounded-full"
                    >
                      {interview.meeting_type}
                    </Badge>
                  )}
                  {interview.interviewer && interview.interviewer !== 'Unknown' && (
                    <Badge variant="outline" className="inline-flex items-center gap-1 text-xs truncate px-2.5 py-1 border-border/60 rounded-full">
                      <Avatar className="h-3 w-3 border border-border/40">
                        <AvatarImage
                          src={session?.user?.image || undefined}
                          alt={session?.user?.name || 'User'}
                        />
                        <AvatarFallback className="text-[6px] font-semibold bg-muted/50 text-foreground/70">
                          {viewerInitials || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{interview.interviewer}</span>
                    </Badge>
                  )}
                  {isInterview && (
                    <div
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 border-border/60 rounded-full text-xs font-medium",
                        "border transition-all duration-300",
                        "shadow-sm hover:shadow",
                        isSubmitted
                          ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
                          : "bg-warning/10 border-warning/30 text-warning hover:bg-warning/15"
                      )}
                    >
                      <div
                        className={cn(
                          "h-1 w-1 rounded-full",
                          isSubmitted ? "bg-success" : "bg-warning"
                        )}
                      />
                      {isSubmitted ? "Submitted" : "Not Submitted"}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/60 backdrop-blur border border-border/50 px-2.5 py-1 rounded-full flex-shrink-0 shadow-sm">
                    <Calendar className="h-3 w-3" />
                    {new Date(interview.meeting_date || interview.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 p-1 bg-card/40 backdrop-blur border border-border/40 rounded-full w-fit shadow-sm flex-shrink-0">
              <button
                onClick={() => setActiveTab('transcript')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  activeTab === 'transcript'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <Search className="h-4 w-4" />
                Transcript
              </button>
              <button
                onClick={() => setActiveTab('ask')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  activeTab === 'ask'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <MagicWandIcon size={16} />
                Ask AI
              </button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <ConversationsSidebar
                interviewId={interview.id}
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </div>
          </div>

          {/* Transcript Fade Gradient */}
          {activeTab === 'transcript' && (
            <div className="absolute bottom-0 left-0 right-0 h-12 translate-y-full bg-gradient-to-b from-background to-transparent pointer-events-none" />
          )}
        </div>

        {/* Submit Feedback Section */}
        <div className="mb-6">
          {isInterview && (
            isSubmitted ? (
              <div className="flex items-center gap-2 text-sm text-success bg-success/10 border border-success/30 px-4 py-2 rounded-full shadow-sm">
                <Check className="h-4 w-4" />
                <span className="font-medium">Submitted</span>
                {submittedDateLabel && <span className="text-success/80">• {submittedDateLabel}</span>}
              </div>
            ) : (
              <Button
                onClick={() => router.push(`/feedback?interviewId=${interview.id}`)}
                className={cn(
                  "h-10 rounded-full px-5 gap-2",
                  "bg-peach text-foreground hover:bg-peach/85",
                  "border border-peach/40 shadow-sm hover:shadow-md transition-all"
                )}
              >
                <ClipboardList className="h-4 w-4" />
                Submit feedback
              </Button>
            )
          )}
        </div>

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="space-y-6 animate-fade-in pt-16">
            {/* Summary */}
            {interview.summary && (
              <Card className="p-6 bg-card/30 border-border/60">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Summary</h3>
                <p className="text-sm leading-relaxed font-light">{interview.summary}</p>
              </Card>
            )}

            {/* Transcript with Search */}
            <Card className="p-6 bg-card/30 border-border/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Transcript</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transcript..."
                      className="pl-9 pr-4 py-2 text-sm bg-background/50 border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 w-64 transition-all"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={copyTranscript} className="hover:bg-muted/50">
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <div className="bg-background/30 p-6 rounded-lg border border-border/40 max-h-[60vh] overflow-y-auto relative">
                <div className="sticky top-0 left-0 right-0 h-8 -mt-6 -mx-6 pointer-events-none z-10" style={{ background: 'linear-gradient(to bottom, hsl(var(--background) / 0.3) 0%, transparent 100%)' }} />
                {normalizedQuery && (
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{visibleTranscriptLines.length}</span> of{' '}
                      <span className="font-medium text-foreground">{transcriptLines.length}</span> matches
                    </p>
                    {visibleTranscriptLines.length === 0 && (
                      <Badge variant="secondary" className="text-[10px] rounded-full">
                        No matches
                      </Badge>
                    )}
                  </div>
                )}
                <div className="space-y-6">
                  {visibleTranscriptLines.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-muted-foreground font-light">
                        No transcript lines match “{searchQuery.trim()}”.
                      </p>
                    </div>
                  ) : (
                    visibleTranscriptLines.map((line) => (
                      <div key={line.id} className="group">
                        {line.speaker && (
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              {isViewerSpeaker(line.speaker) ? (
                                <Avatar className="h-8 w-8 border border-border/40 flex-shrink-0">
                                  <AvatarImage
                                    src={session?.user?.image || undefined}
                                    alt={session?.user?.name || 'You'}
                                  />
                                  <AvatarFallback className="text-xs font-semibold bg-muted/50 text-foreground/70">
                                    {viewerInitials || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-peach/20 flex items-center justify-center border border-peach/30 flex-shrink-0">
                                  <span className="text-xs font-semibold text-foreground/80">
                                    {line.speaker.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm font-semibold text-foreground">
                                {line.speaker}
                              </span>
                            </div>
                            {line.timestamp && (
                              <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded">
                                {line.timestamp}
                              </span>
                            )}
                          </div>
                        )}
                        <p className={cn(
                          "text-sm leading-relaxed font-light",
                          // Align content with start of speaker name (avatar 32px + gap-2 = 8px)
                          line.speaker ? "ml-10" : "text-muted-foreground/90 italic"
                        )}>
                          {highlightText(line.content, searchQuery)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Ask AI Tab */}
        {activeTab === 'ask' && (
          <div className="animate-fade-in flex flex-col relative" style={{ height: messages.length > 0 ? 'calc(100vh - 180px)' : 'calc(100vh - 240px)' }}>
            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto pb-32 relative">
              <div className="sticky top-0 left-0 right-0 h-24 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none z-30 -mb-24" />
              <div className="max-w-3xl mx-auto px-4 pt-8">
                {messages.length === 0 && !asking ? (
                  <div className="flex flex-col items-center justify-center text-center py-24 min-h-[50vh]">
                    <div className="mb-6 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 animate-float">
                      <MagicWandIcon size={28} className="text-primary" />
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground mb-3 animate-fade-in" style={{ animationDelay: '100ms' }}>Ask about this interview</h3>
                    <p className="text-muted-foreground max-w-md mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
                      Get instant insights about {interview.candidate_name}'s interview.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center animate-fade-in" style={{ animationDelay: '300ms' }}>
                      {[
                        "What are their key strengths?",
                        "Any concerns or red flags?",
                        "Summarize their experience"
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setAiQuestion(suggestion)}
                          className="px-4 py-2 text-sm text-muted-foreground bg-card/40 hover:bg-muted border border-border/50 rounded-full transition-all duration-300 hover:border-primary/30 hover:text-foreground hover:scale-105 hover:shadow-md active:scale-95"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 py-6">
                    {messages.map((message, index) => (
                      message.role === 'user' ? (
                        <Message key={message.id} from="user" className={index === messages.length - 1 || index === messages.length - 2 ? "animate-fade-in-left" : ""}>
                          <MessageContent>
                            <p className="text-sm">{message.content}</p>
                          </MessageContent>
                          <MessageAvatar
                            name={session?.user?.name || "You"}
                            src={session?.user?.image || undefined}
                            className="bg-muted"
                          />
                        </Message>
                      ) : (
                        <Message key={message.id} from="assistant" className={index === messages.length - 1 ? "animate-fade-in-right" : ""}>
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/10 transition-all duration-300 hover:scale-110">
                            <MagicWandIcon size={14} className="text-primary" />
                          </div>
                          <div className="flex-1 space-y-4">
                            <MessageContent>
                              <Response>{message.content}</Response>
                            </MessageContent>

                            {message.sources && message.sources.length > 0 && (
                              <div className="flex gap-2 flex-wrap items-center">
                                <span className="text-xs text-muted-foreground">Based on interviews with:</span>
                                {message.sources.map(source => (
                                  <Link key={source.id} href={`/history/${source.id}`}>
                                    <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors">
                                      {source.candidateName}
                                    </Badge>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </Message>
                      )
                    ))}

                    {asking && (
                      <Message from="assistant" className="animate-fade-in-right">
                        <div className="h-8 w-8 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30 animate-glow-pulse">
                          <MagicWandIcon size={14} className="text-primary animate-pulse" />
                        </div>
                        <MessageContent variant="flat">
                          <div className="flex items-center gap-3 py-2">
                            <ShimmeringText
                              text="Analyzing interview..."
                              className="text-sm text-muted-foreground"
                            />
                          </div>
                        </MessageContent>
                      </Message>
                    )}


                    <div ref={conversationEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-8" style={{ background: 'linear-gradient(to top, hsl(var(--background)) 70%, transparent)' }}>
              <div className="max-w-2xl mx-auto">
                <div className="relative group">
                  <div className="relative bg-card/60 backdrop-blur-md border border-border/30 rounded-xl shadow-lg transition-all duration-300 group-focus-within:border-primary/30 group-focus-within:shadow-xl overflow-hidden min-h-[54px] flex flex-col justify-end">
                    <form onSubmit={handleAskQuestion} className="flex items-end gap-2">
                      <div className="flex items-center pl-3 h-[54px]">
                        <VoiceRecorder
                          onTranscriptionComplete={(text) => setAiQuestion(prev => prev ? `${prev} ${text}` : text)}
                          onRecordingChange={setIsRecording}
                        />
                      </div>

                      {!isRecording && (
                        <>
                          <div className="flex-1 py-1.5">
                            <Textarea
                              value={aiQuestion}
                              onChange={(e) => {
                                setAiQuestion(e.target.value)
                                e.target.style.height = 'auto'
                                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  if (aiQuestion.trim() && !asking) {
                                    handleAskQuestion(e as any)
                                  }
                                }
                              }}
                              placeholder={messages.length > 0 ? "Ask follow-up..." : `Ask about ${interview.candidate_name}...`}
                              className="min-h-[44px] max-h-[160px] py-2.5 px-4 bg-input focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto text-[15px] placeholder:text-muted-foreground/50"
                              rows={1}
                            />
                          </div>

                          <div className="flex items-center justify-center pr-2.5 pb-2.5">
                            <button
                              type="submit"
                              disabled={asking || !aiQuestion.trim()}
                              className={cn(
                                "h-9 w-9 rounded-xl inline-flex items-center justify-center flex-shrink-0 transition-all duration-200",
                                aiQuestion.trim()
                                  ? "bg-peach text-foreground hover:bg-peach/80"
                                  : "text-muted-foreground/30"
                              )}
                            >
                              <Send
                                className={cn(
                                  "h-[18px] w-[18px] transition-transform duration-200",
                                  aiQuestion.trim() && "-rotate-45 translate-y-[2px]"
                                )}
                                strokeWidth={2}
                              />
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
