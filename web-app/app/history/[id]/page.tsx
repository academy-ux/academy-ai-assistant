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
import { ArrowLeft, Calendar, User, Send, Search, Copy, Check } from 'lucide-react'
import { MagicWandIcon } from '@/components/icons/magic-wand'
import { VoiceRecorder } from '@/components/voice-recorder'
import { Message, MessageContent, MessageAvatar } from '@/components/ui/message'
import { Response } from '@/components/ui/response'
import { cn } from '@/lib/utils'

interface Interview {
  id: string
  candidate_name: string
  interviewer?: string
  position: string
  meeting_title: string
  meeting_date?: string
  summary?: string
  transcript: string
  created_at: string
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
  const conversationEndRef = useRef<HTMLDivElement>(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchInterview(params.id as string)
    }
  }, [params.id])

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
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Ask failed', error)
      const errorMessage: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
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
  }

  function copyTranscript() {
    if (interview?.transcript) {
      navigator.clipboard.writeText(interview.transcript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Highlight search matches in transcript
  function highlightText(text: string, query: string) {
    if (!query.trim()) return text
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    const parts = text.split(regex)
    // Check if part matches query (case-insensitive) instead of using regex.test()
    // which has lastIndex issues with the global flag
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-peach/30 text-foreground px-1 rounded">{part}</mark> 
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </button>
          
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30">
                <span className="text-lg font-semibold text-foreground/80">
                  {(interview.candidate_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-normal text-foreground mb-2">
                  {interview.candidate_name || 'Unknown Candidate'}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {interview.position && (
                    <Badge variant="secondary" className="text-sm bg-peach/20 text-foreground border-peach/30">{interview.position}</Badge>
                  )}
                  {interview.meeting_title && interview.meeting_title !== 'Interview' && (
                    <Badge variant="outline" className="text-sm border-border/40">{interview.meeting_title}</Badge>
                  )}
                  {interview.interviewer && interview.interviewer !== 'Unknown' && (
                    <span className="text-sm text-muted-foreground font-light">with {interview.interviewer}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-card/40 border border-border/40 px-3 py-2 rounded-lg flex-shrink-0">
              <Calendar className="h-4 w-4" />
              {new Date(interview.meeting_date || interview.created_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-lg w-fit mb-6">
          <button
            onClick={() => setActiveTab('transcript')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              activeTab === 'transcript'
                ? "bg-card/60 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Search className="h-4 w-4" />
            Transcript
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              activeTab === 'ask'
                ? "bg-card/60 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <MagicWandIcon size={16} />
            Ask AI
          </button>
        </div>

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="space-y-6 animate-fade-in">
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
              <div className="bg-background/30 p-4 rounded-lg border border-border/40 max-h-[60vh] overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-light">
                  {highlightText(interview.transcript || 'No transcript available', searchQuery)}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Ask AI Tab */}
        {activeTab === 'ask' && (
          <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 320px)' }}>
            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="max-w-3xl mx-auto">
                {messages.length === 0 && !asking ? (
                  <div className="flex flex-col items-center justify-center text-center py-24 min-h-[50vh]">
                    <div className="mb-6 h-16 w-16 rounded-full bg-peach/20 flex items-center justify-center border border-peach/30 animate-float">
                      <MagicWandIcon size={28} className="text-primary" />
                    </div>
                    <h3 className="text-2xl font-normal text-foreground mb-3 animate-fade-in" style={{ animationDelay: '100ms' }}>Ask about this interview</h3>
                    <p className="text-muted-foreground max-w-md mb-6 font-light animate-fade-in" style={{ animationDelay: '200ms' }}>
                      Get insights about {interview.candidate_name}'s interview
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
                          className="px-4 py-2 text-sm text-muted-foreground bg-card/40 hover:bg-muted border border-border/40 rounded-full transition-all duration-300 hover:border-primary/30 hover:text-foreground hover:scale-105 hover:shadow-md active:scale-95"
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
                        <Message key={message.id} from="user" className={index >= messages.length - 2 ? "animate-fade-in-left" : ""}>
                          <MessageContent>
                            <p className="text-sm">{message.content}</p>
                          </MessageContent>
                          <MessageAvatar name="You" className="bg-muted" />
                        </Message>
                      ) : (
                        <Message key={message.id} from="assistant" className={index === messages.length - 1 ? "animate-fade-in-right" : ""}>
                          <div className="h-8 w-8 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30">
                            <MagicWandIcon size={14} className="text-primary" />
                          </div>
                          <MessageContent>
                            <Response>{message.content}</Response>
                          </MessageContent>
                        </Message>
                      )
                    ))}

                    {asking && (
                      <Message from="assistant" className="animate-fade-in-right">
                        <div className="h-8 w-8 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30 animate-pulse">
                          <MagicWandIcon size={14} className="text-primary" />
                        </div>
                        <MessageContent variant="flat">
                          <div className="flex items-center gap-3 text-muted-foreground py-2">
                            <Spinner size={16} />
                            <span className="text-sm font-light">Analyzing interview...</span>
                          </div>
                        </MessageContent>
                      </Message>
                    )}

                    {messages.length > 0 && !asking && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={clearConversation}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear conversation
                        </button>
                      </div>
                    )}
                    
                    <div ref={conversationEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="fixed bottom-4 left-0 right-0 px-4 pb-4 pt-8" style={{ background: 'linear-gradient(to top, hsl(var(--background)) 60%, transparent)' }}>
              <div className="max-w-2xl mx-auto group">
                <div className="relative bg-card/60 backdrop-blur-md border border-border/30 rounded-xl shadow-lg transition-all duration-300 group-focus-within:border-primary/30 group-focus-within:shadow-xl overflow-hidden">
                  <form onSubmit={handleAskQuestion} className="flex items-end gap-2">
                    <div className="flex items-center pl-3 pb-2.5">
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
                            className="min-h-[44px] max-h-[160px] py-2.5 px-4 border-0 bg-input focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto text-[15px] placeholder:text-muted-foreground/50"
                            rows={1}
                          />
                        </div>
                        
                        <div className="flex items-center pr-2.5 pb-2.5">
                          <button 
                            type="submit"
                            disabled={asking || !aiQuestion.trim()}
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
                              aiQuestion.trim() 
                                ? "text-primary hover:bg-primary/10" 
                                : "text-muted-foreground/30"
                            )}
                          >
                            <Send className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              aiQuestion.trim() && "-rotate-45"
                            )} />
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
