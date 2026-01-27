'use client'

import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Analysis {
  rating: string
  strengths: string
  concerns: string
  technicalSkills: string
  culturalFit: string
  recommendation: string
  keyQuotes: string[]
  candidateName: string | null
  alternativeRatings: { rating: string; reasoning: string }[]
}

interface Candidate {
  id: string
  name: string
  email: string
  position: string
  stage: string
}

interface Template {
  id: string
  name: string
}

function FeedbackContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  // State
  const [transcript, setTranscript] = useState('')
  const [transcriptFileName, setTranscriptFileName] = useState('')
  const [transcriptLoading, setTranscriptLoading] = useState(true)
  const [transcriptError, setTranscriptError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [countdown, setCountdown] = useState(30)

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)

  const [formData, setFormData] = useState({
    rating: '3 - Hire',
    strengths: '',
    concerns: '',
    technicalSkills: '',
    culturalFit: '',
    recommendation: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')

  const meetingTitle = searchParams.get('title') || ''
  const meetingCode = searchParams.get('meeting') || ''

  // Load candidates and templates on mount
  useEffect(() => {
    if (session) {
      loadCandidates()
      loadTemplates()
    }
  }, [session])

  // Start transcript fetch countdown
  useEffect(() => {
    if (session && transcriptLoading && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    } else if (session && transcriptLoading && countdown === 0) {
      fetchTranscript()
    }
  }, [session, transcriptLoading, countdown])

  async function fetchTranscript() {
    try {
      const params = new URLSearchParams()
      if (meetingTitle) params.set('title', meetingTitle)
      if (meetingCode) params.set('code', meetingCode)

      const res = await fetch(`/api/transcript?${params}`)
      const data = await res.json()

      if (data.success) {
        setTranscript(data.transcript)
        setTranscriptFileName(data.fileName)
        setTranscriptLoading(false)
        // Auto-start analysis
        analyzeTranscript(data.transcript)
      } else {
        // Retry logic
        if (retryCount < 6) {
          setRetryCount(r => r + 1)
          setCountdown(15)
        } else {
          setTranscriptError(data.message || 'No transcript found')
          setTranscriptLoading(false)
        }
      }
    } catch (err: any) {
      setTranscriptError(err.message)
      setTranscriptLoading(false)
    }
  }

  async function analyzeTranscript(text: string) {
    setAnalysisLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          meetingTitle,
          meetingDate: new Date().toLocaleDateString(),
        }),
      })
      const data = await res.json()

      if (data.success) {
        setAnalysis(data.analysis)
        setFormData({
          rating: data.analysis.rating || '3 - Hire',
          strengths: data.analysis.strengths || '',
          concerns: data.analysis.concerns || '',
          technicalSkills: data.analysis.technicalSkills || '',
          culturalFit: data.analysis.culturalFit || '',
          recommendation: data.analysis.recommendation || '',
        })

        // Try to auto-match candidate
        if (data.analysis.candidateName) {
          autoMatchCandidate(data.analysis.candidateName)
        }
      }
    } catch (err: any) {
      setError('Analysis failed: ' + err.message)
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function loadCandidates() {
    try {
      const res = await fetch('/api/lever/candidates')
      const data = await res.json()
      if (data.success) {
        setCandidates(data.candidates)
      }
    } catch (err) {
      console.error('Failed to load candidates:', err)
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/lever/templates')
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates)
        // Auto-select interview template
        const interviewTemplate = data.templates.find((t: Template) =>
          t.name.toLowerCase().includes('interview')
        )
        if (interviewTemplate) {
          setSelectedTemplate(interviewTemplate.id)
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  function autoMatchCandidate(name: string) {
    const nameLower = name.toLowerCase()
    const match = candidates.find(c =>
      c.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(c.name.toLowerCase())
    )
    if (match) {
      setSelectedCandidate(match.id)
    }
  }

  async function handleSubmit() {
    if (!selectedCandidate || !selectedTemplate) {
      setError('Please select a candidate and template')
      return
    }

    setSubmitting(true)
    setError('')

    const candidate = candidates.find(c => c.id === selectedCandidate)

    try {
      const res = await fetch('/api/lever/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedCandidate,
          templateId: selectedTemplate,
          feedback: formData,
          // Extra data for Supabase
          transcript,
          meetingTitle,
          meetingCode,
          candidateName: candidate?.name,
          position: candidate?.position,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setSubmitSuccess(true)
      } else {
        setError(data.message || 'Submission failed')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>
              Sign in with Google to access your Meet transcripts
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => signIn('google')} size="lg">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4">
              ✓
            </div>
            <CardTitle>Feedback Submitted!</CardTitle>
            <CardDescription>
              Your feedback has been submitted to Lever.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.close()} variant="outline">
              Close Tab
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Header Section */}
        <div className="lg:col-span-12 flex justify-between items-center mb-4">
          <div>
             <h1 className="text-3xl font-display font-bold">Feedback Assessment</h1>
             <p className="text-muted-foreground">{meetingTitle || meetingCode || 'Interview'} • {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Left: Transcript */}
        <div className="lg:col-span-5 h-[calc(100vh-12rem)] min-h-[600px]">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>Transcript</CardTitle>
                {transcriptFileName && (
                   <Badge variant="outline" className="font-normal text-muted-foreground">
                      {transcriptFileName}
                   </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
               {transcriptLoading ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <div>
                    <h3 className="font-medium mb-1">
                      {countdown > 0 ? 'Waiting for transcript...' : 'Searching Google Drive...'}
                    </h3>
                    {countdown > 0 && (
                      <span className="text-2xl font-bold text-primary block">{countdown}</span>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      {retryCount > 0 ? `Attempt ${retryCount + 1}/7` : 'Transcripts typically appear 1-2 mins after the meeting'}
                    </p>
                  </div>
                </div>
              ) : transcriptError ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="text-destructive text-4xl mb-2">!</div>
                  <h3 className="font-medium">Transcript not found</h3>
                  <p className="text-sm text-muted-foreground">{transcriptError}</p>
                  <Button 
                    onClick={() => {
                      setTranscriptError('')
                      setTranscriptLoading(true)
                      setRetryCount(0)
                      setCountdown(5)
                    }}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-4 text-sm font-mono leading-relaxed text-muted-foreground">
                     {transcript}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Feedback Form */}
        <div className="lg:col-span-7 h-[calc(100vh-12rem)] min-h-[600px]">
          <Card className="h-full flex flex-col">
             <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle>Evaluation</CardTitle>
                <CardDescription>AI-assisted feedback form connected to Lever</CardDescription>
             </CardHeader>
             
             <CardContent className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Match Selection */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>Candidate / Opportunity</Label>
                      <Popover open={candidateOpen} onOpenChange={setCandidateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={candidateOpen}
                            className="w-full justify-between"
                          >
                            {selectedCandidate
                              ? candidates.find((c) => c.id === selectedCandidate)?.name
                              : "Select candidate..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search candidate..." />
                            <CommandList>
                              <CommandEmpty>No candidate found.</CommandEmpty>
                              <CommandGroup>
                                {candidates.map((candidate) => (
                                  <CommandItem
                                    key={candidate.id}
                                    value={`${candidate.name} ${candidate.position}`}
                                    onSelect={() => {
                                      setSelectedCandidate(candidate.id)
                                      setCandidateOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCandidate === candidate.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{candidate.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {candidate.position} • <span className="text-primary/80">{candidate.stage}</span>
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                   </div>
                   <div className="space-y-2">
                      <Label>Feedback Form (Template)</Label>
                      <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={templateOpen}
                            className="w-full justify-between"
                          >
                            {selectedTemplate
                              ? templates.find((t) => t.id === selectedTemplate)?.name
                              : "Select template..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search template..." />
                            <CommandList>
                              <CommandEmpty>No template found.</CommandEmpty>
                              <CommandGroup>
                                {templates.map((template) => (
                                  <CommandItem
                                    key={template.id}
                                    value={template.name}
                                    onSelect={() => {
                                      setSelectedTemplate(template.id)
                                      setTemplateOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedTemplate === template.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {template.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                   </div>
                </div>

                <Separator />

                {analysisLoading ? (
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <Skeleton className="h-4 w-24" />
                         <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="space-y-2">
                         <Skeleton className="h-4 w-24" />
                         <Skeleton className="h-24 w-full" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         <div className="animate-spin h-3 w-3 border-b-2 border-primary rounded-full"></div>
                         Analyzing transcript...
                      </div>
                   </div>
                ) : (
                   <div className="space-y-6">
                      {/* Rating */}
                      <div className="space-y-3">
                         <Label>Overall Rating</Label>
                         <Select 
                            value={formData.rating} 
                            onValueChange={(val) => setFormData({ ...formData, rating: val })}
                         >
                            <SelectTrigger>
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="4 - Strong Hire">4 - Strong Hire</SelectItem>
                               <SelectItem value="3 - Hire">3 - Hire</SelectItem>
                               <SelectItem value="2 - No Hire">2 - No Hire</SelectItem>
                               <SelectItem value="1 - Strong No Hire">1 - Strong No Hire</SelectItem>
                            </SelectContent>
                         </Select>
                         
                         {analysis?.alternativeRatings && analysis.alternativeRatings.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                               {analysis.alternativeRatings.map((alt, i) => (
                                  <Badge 
                                    key={i} 
                                    variant="outline" 
                                    className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => setFormData({ ...formData, rating: alt.rating })}
                                    title={alt.reasoning}
                                  >
                                    Consider: {alt.rating}
                                  </Badge>
                               ))}
                            </div>
                         )}
                      </div>

                      <div className="grid gap-6">
                         <div className="space-y-2">
                            <Label>Strengths</Label>
                            <Textarea 
                               value={formData.strengths} 
                               onChange={e => setFormData({ ...formData, strengths: e.target.value })}
                               rows={3}
                            />
                         </div>
                         
                         <div className="space-y-2">
                            <Label>Concerns</Label>
                            <Textarea 
                               value={formData.concerns} 
                               onChange={e => setFormData({ ...formData, concerns: e.target.value })}
                               rows={3}
                            />
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <Label>Technical Skills</Label>
                               <Textarea 
                                  value={formData.technicalSkills} 
                                  onChange={e => setFormData({ ...formData, technicalSkills: e.target.value })}
                                  rows={4}
                               />
                            </div>
                            <div className="space-y-2">
                               <Label>Cultural Fit</Label>
                               <Textarea 
                                  value={formData.culturalFit} 
                                  onChange={e => setFormData({ ...formData, culturalFit: e.target.value })}
                                  rows={4}
                               />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <Label>Recommendation</Label>
                            <Textarea 
                               value={formData.recommendation} 
                               onChange={e => setFormData({ ...formData, recommendation: e.target.value })}
                               rows={2}
                            />
                         </div>
                      </div>

                      {analysis?.keyQuotes && analysis.keyQuotes.length > 0 && (
                         <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Key Quotes</Label>
                            <ul className="space-y-2">
                               {analysis.keyQuotes.map((q, i) => (
                                  <li key={i} className="text-sm italic text-muted-foreground pl-3 border-l-2 border-primary/30">
                                     "{q}"
                                  </li>
                               ))}
                            </ul>
                         </div>
                      )}

                      {error && (
                         <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                            {error}
                         </div>
                      )}
                   </div>
                )}
             </CardContent>
             
             <div className="p-4 border-t border-border/40 bg-muted/10 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                   {selectedCandidate && selectedTemplate ? 'Ready to submit' : 'Select candidate & template to submit'}
                </span>
                <Button 
                   onClick={handleSubmit} 
                   disabled={!selectedCandidate || !selectedTemplate || submitting || analysisLoading}
                >
                   {submitting ? 'Submitting...' : 'Submit to Lever'}
                </Button>
             </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  )
}
