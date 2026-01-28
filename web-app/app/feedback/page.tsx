'use client'

import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Check, ChevronsUpDown, Search, FileText, User, ClipboardList, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoiceRecorder } from '@/components/voice-recorder'
import { cn } from '@/lib/utils'

interface Analysis {
  rating: string
  strengths: string
  concerns: string
  technicalSkills: string
  culturalFit: string
  recommendation: string
  keyQuotes: string[]
  candidateName: string | null
  alternativeRatings?: { rating: string; reasoning: string }[]
  answers?: Record<string, string>
}

interface Candidate {
  id: string
  name: string
  email: string
  position: string
  stage: string
}

interface Posting {
  id: string
  text: string
  team: string
  location: string
  count?: number
}

interface TemplateField {
  text: string
  description?: string
  required: boolean
  type: string
}

interface Template {
  id: string
  name: string
  instructions: string
  fields: TemplateField[]
}

function FeedbackContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()

  const [transcript, setTranscript] = useState('')
  const [transcriptFileName, setTranscriptFileName] = useState('')
  const [transcriptLoading, setTranscriptLoading] = useState(true)
  const [transcriptError, setTranscriptError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [countdown, setCountdown] = useState(30)

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const [postings, setPostings] = useState<Posting[]>([])
  const [postingsLoading, setPostingsLoading] = useState(true)
  const [selectedPosting, setSelectedPosting] = useState('')
  
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  
  const [postingSearch, setPostingSearch] = useState('')
  const [postingOpen, setPostingOpen] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateOpen, setCandidateOpen] = useState(false)
  
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, any>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')

  const meetingTitle = searchParams.get('title') || ''
  const meetingCode = searchParams.get('meeting') || ''

  useEffect(() => {
    if (session) {
      loadPostings()
      loadTemplates()
    }
  }, [session])

  useEffect(() => {
    if (selectedPosting) {
      loadCandidates(selectedPosting)
      setSelectedCandidate('')
    }
  }, [selectedPosting])

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
      // Don't attempt to fetch if we don't have any search parameters
      if (!meetingTitle && !meetingCode) {
        setTranscriptError('No meeting title or code provided')
        setTranscriptLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (meetingTitle) params.set('title', meetingTitle)
      if (meetingCode) params.set('code', meetingCode)

      const res = await fetch(`/api/transcript?${params}`)
      const data = await res.json()

      if (data.success) {
        setTranscript(data.transcript)
        setTranscriptFileName(data.fileName)
        setTranscriptLoading(false)
        analyzeTranscript(data.transcript)
      } else {
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

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate) || null
      setCurrentTemplate(template)
      setDynamicAnswers({})
    }
  }, [selectedTemplate, templates])

  async function analyzeTranscript(text: string) {
    setAnalysisLoading(true)
    try {
      const templateContext = currentTemplate ? {
        fields: currentTemplate.fields.map(f => ({
          question: f.text,
          description: f.description,
          type: f.type
        }))
      } : null

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          meetingTitle,
          meetingDate: new Date().toLocaleDateString(),
          template: templateContext
        }),
      })
      const data = await res.json()

      if (data.success) {
        setAnalysis(data.analysis)
        
        if (data.analysis.answers) {
           setDynamicAnswers(data.analysis.answers)
        } else {
           setDynamicAnswers({
             "Overall Rating": data.analysis.rating,
             "Strengths": data.analysis.strengths,
             "Concerns": data.analysis.concerns,
             "Technical Skills": data.analysis.technicalSkills,
             "Cultural Fit": data.analysis.culturalFit,
             "Recommendation": data.analysis.recommendation
           })
        }

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

  async function loadPostings() {
    setPostingsLoading(true)
    try {
      const res = await fetch('/api/lever/postings')
      const data = await res.json()
      if (data.success) {
        setPostings(data.postings)
      }
    } catch (err) {
      console.error('Failed to load postings:', err)
    } finally {
      setPostingsLoading(false)
    }
  }

  async function loadCandidates(postingId: string) {
    setCandidatesLoading(true)
    setCandidates([])
    try {
      const res = await fetch(`/api/lever/candidates?postingId=${postingId}`)
      const data = await res.json()
      if (data.success) {
        setCandidates(data.candidates)
      }
    } catch (err) {
      console.error('Failed to load candidates:', err)
    } finally {
      setCandidatesLoading(false)
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true)
    setTemplatesError('')
    try {
      const res = await fetch('/api/lever/templates')
      const data = await res.json()
      
      if (data.success && data.templates) {
        setTemplates(data.templates)
        
        const interviewTemplate = data.templates.find((t: Template) =>
          t.name.toLowerCase().includes('interview')
        )
        if (interviewTemplate) {
          setSelectedTemplate(interviewTemplate.id)
        } else if (data.templates.length > 0) {
          setSelectedTemplate(data.templates[0].id)
        }
      } else {
        setTemplatesError(data.message || 'No templates found')
        console.error('Templates load failed:', data)
      }
    } catch (err: any) {
      console.error('Failed to load templates:', err)
      setTemplatesError(err.message || 'Failed to load templates')
    } finally {
      setTemplatesLoading(false)
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
      // Map dynamic answers to the expected backend format
      const formattedFeedback = {
        rating: dynamicAnswers['Rating'] || '',
        strengths: dynamicAnswers['Strengths'] || '',
        concerns: dynamicAnswers['Concerns'] || '',
        technicalSkills: dynamicAnswers['Technical Skills'] || '',
        culturalFit: dynamicAnswers['Cultural Fit'] || '',
        recommendation: dynamicAnswers['Recommendation'] || '',
      }

      const res = await fetch('/api/lever/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedCandidate,
          templateId: selectedTemplate,
          feedback: formattedFeedback,
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size={32} className="text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60 bg-card/40">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-normal">Sign in Required</CardTitle>
            <CardDescription className="font-light">
              Sign in with Google to access your Meet transcripts
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <Button onClick={() => signIn('google')} size="lg" className="w-full max-w-xs h-11 rounded-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md text-center border-border/60 bg-card/40">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-peach/20 text-primary rounded-full flex items-center justify-center border border-peach/30">
              <CheckCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-normal">Feedback Submitted!</CardTitle>
            <CardDescription className="font-light">
              Your feedback has been successfully submitted to Lever.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button onClick={() => window.close()} variant="outline" className="w-full max-w-xs h-11 rounded-full border-border/60 hover:bg-muted/50">
              Close Tab
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase mb-3">Feedback Assessment</p>
          <h1 className="text-4xl md:text-5xl font-normal tracking-tight text-foreground mb-4">
            Evaluation
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-muted-foreground">
            {(meetingTitle || meetingCode) && (
              <p className="font-light text-base break-words max-w-3xl">
                {meetingTitle || meetingCode}
              </p>
            )}
            {(meetingTitle || meetingCode) && (
              <span className="hidden sm:inline text-muted-foreground/40">•</span>
            )}
            <p className="font-light text-base whitespace-nowrap">
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Transcript */}
          <div className="lg:col-span-5 h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="h-full flex flex-col border border-border/60 rounded-xl bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/40 flex justify-between items-center bg-card/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary/30 flex items-center justify-center">
                     <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-sm tracking-wide">TRANSCRIPT</span>
                </div>
                {transcriptFileName && (
                   <span className="text-[10px] text-muted-foreground uppercase tracking-widest border border-border/40 rounded-full px-3 py-1">
                      {transcriptFileName}
                   </span>
                )}
              </div>
              <div className="flex-1 p-0 overflow-hidden">
                 {transcriptLoading ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <Spinner size={40} className="text-primary" />
                    <div>
                      <h3 className="font-medium mb-1">
                        {countdown > 0 ? 'Waiting for transcript...' : 'Searching Google Drive...'}
                      </h3>
                      {countdown > 0 && (
                        <span className="text-3xl font-bold text-primary block mt-2">{countdown}</span>
                      )}
                      <p className="text-sm text-muted-foreground mt-3">
                        {retryCount > 0 ? `Attempt ${retryCount + 1}/7` : 'Transcripts typically appear 1-2 mins after the meeting'}
                      </p>
                    </div>
                  </div>
                  ) : transcriptError ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xl font-bold border border-destructive/20">!</div>
                    <h3 className="font-medium">Transcript not found</h3>
                    <p className="text-sm text-muted-foreground max-w-xs font-light">{transcriptError}</p>
                    <Button 
                      onClick={() => {
                        setTranscriptError('')
                        setTranscriptLoading(true)
                        setRetryCount(0)
                        setCountdown(5)
                      }}
                      variant="outline"
                      className="h-10 rounded-full border-border/60 hover:bg-muted/50"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                       {transcript}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>

          {/* Right: Feedback Form */}
          <div className="lg:col-span-7 h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="h-full flex flex-col border border-border/60 rounded-xl bg-card/30 overflow-hidden">
               <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3 bg-card/20 backdrop-blur-sm">
                  <div className="h-8 w-8 rounded-full bg-secondary/30 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="font-medium text-sm tracking-wide block">EVALUATION FORM</span>
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Selection Flow */}
                  <div className="grid gap-4">
                     {/* Step 1: Select Opportunity */}
                     <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-peach/20 text-primary text-xs flex items-center justify-center font-semibold border border-peach/30">1</span>
                          Opportunity
                        </Label>
                        <Popover open={postingOpen} onOpenChange={setPostingOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full h-11 px-3 justify-between font-normal"
                              disabled={postingsLoading}
                            >
                              <span className="truncate">
                                {postingsLoading 
                                  ? "Loading jobs..." 
                                  : selectedPosting 
                                    ? postings.find(p => p.id === selectedPosting)?.text 
                                    : "Select job..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[600px] p-0" align="start">
                            <div className="p-3 border-b">
                              <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-lg">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Input
                                  placeholder="Search jobs..."
                                  value={postingSearch}
                                  onChange={(e) => setPostingSearch(e.target.value)}
                                  className="h-9 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm shadow-none"
                                />
                              </div>
                            </div>
                            <ScrollArea className="h-[280px]">
                              <div className="p-2">
                                {postings
                                  .filter(p => 
                                    p.text.toLowerCase().includes(postingSearch.toLowerCase()) ||
                                    (p.team && p.team.toLowerCase().includes(postingSearch.toLowerCase()))
                                  )
                                  .map((posting) => (
                                    <div
                                      key={posting.id}
                                      className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                                        "hover:bg-accent",
                                        selectedPosting === posting.id && "bg-accent"
                                      )}
                                      onClick={() => {
                                        setSelectedPosting(posting.id)
                                        setPostingOpen(false)
                                        setPostingSearch('')
                                      }}
                                    >
                                      <Check className={cn("h-4 w-4 shrink-0 text-primary", selectedPosting === posting.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-sm font-medium">{posting.text}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {posting.count ? `${posting.count} candidates` : ''}
                                          {posting.team ? ` • ${posting.team}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                     </div>
                     
                     {/* Step 2: Select Candidate */}
                     <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-peach/20 text-primary text-xs flex items-center justify-center font-semibold border border-peach/30">2</span>
                          Candidate
                        </Label>
                        <Popover open={candidateOpen} onOpenChange={setCandidateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full h-11 px-3 justify-between font-normal"
                              disabled={!selectedPosting || candidatesLoading}
                            >
                              <span className="truncate">
                                {candidatesLoading 
                                  ? "Loading..." 
                                  : !selectedPosting 
                                    ? "Select job first" 
                                    : selectedCandidate 
                                      ? candidates.find(c => c.id === selectedCandidate)?.name 
                                      : "Select candidate..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[600px] p-0" align="start">
                            <div className="p-3 border-b">
                              <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-lg">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Input
                                  placeholder="Search candidates..."
                                  value={candidateSearch}
                                  onChange={(e) => setCandidateSearch(e.target.value)}
                                  className="h-9 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm shadow-none"
                                />
                              </div>
                            </div>
                            <ScrollArea className="h-[280px]">
                              <div className="p-2">
                                {candidates
                                  .filter(c => 
                                    c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
                                    c.stage.toLowerCase().includes(candidateSearch.toLowerCase())
                                  )
                                  .map((candidate) => (
                                    <div
                                      key={candidate.id}
                                      className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                                        "hover:bg-accent",
                                        selectedCandidate === candidate.id && "bg-accent"
                                      )}
                                      onClick={() => {
                                        setSelectedCandidate(candidate.id)
                                        setCandidateOpen(false)
                                        setCandidateSearch('')
                                      }}
                                    >
                                      <Check className={cn("h-4 w-4 shrink-0 text-primary", selectedCandidate === candidate.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-sm font-medium">{candidate.name}</span>
                                        <span className="text-xs text-muted-foreground">{candidate.stage}</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                     </div>
                     
                     {/* Step 3: Select Template */}
                     <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-peach/20 text-primary text-xs flex items-center justify-center font-semibold border border-peach/30">3</span>
                          Feedback Form
                        </Label>
                        <Select 
                          value={selectedTemplate} 
                          onValueChange={(value) => setSelectedTemplate(value)}
                          disabled={templatesLoading}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              templatesLoading 
                                ? "Loading forms..." 
                                : templatesError 
                                  ? "Error loading" 
                                  : templates.length === 0 
                                    ? "No forms available" 
                                    : "Select form..."
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.length === 0 ? (
                              <div className="p-4 text-sm text-muted-foreground text-center">
                                {templatesError || "No feedback templates found in Lever"}
                              </div>
                            ) : (
                              templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {templatesError && (
                          <p className="text-xs text-destructive">{templatesError}</p>
                        )}
                     </div>
                  </div>

                  <Separator />

                  {analysisLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                      <Spinner size={48} className="text-primary" />
                      <p className="font-medium">
                        Analyzing transcript...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Based on "{currentTemplate?.name || 'Default'}" form
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                        {currentTemplate ? (
                           <div className="space-y-5">
                              {currentTemplate.fields.map((field, idx) => (
                                 <div key={idx} className="space-y-2">
                                    <Label className="text-sm font-medium">
                                       {field.text}
                                       {field.required && <span className="text-primary ml-1">*</span>}
                                    </Label>
                                    {field.description && (
                                       <p className="text-xs text-muted-foreground">{field.description}</p>
                                    )}
                                    
                                    {(field.type === 'score-system' || field.text.toLowerCase().includes('rating')) ? (
                                       <Select 
                                          value={dynamicAnswers[field.text] || ''} 
                                          onValueChange={(val) => setDynamicAnswers({...dynamicAnswers, [field.text]: val})}
                                       >
                                          <SelectTrigger className="h-11">
                                             <SelectValue placeholder="Select rating..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="4 - Strong Hire">4 - Strong Hire</SelectItem>
                                             <SelectItem value="3 - Hire">3 - Hire</SelectItem>
                                             <SelectItem value="2 - No Hire">2 - No Hire</SelectItem>
                                             <SelectItem value="1 - Strong No Hire">1 - Strong No Hire</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    ) : (
                                      <div className="relative">
                                        <Textarea 
                                          value={dynamicAnswers[field.text] || ''}
                                          onChange={(e) => setDynamicAnswers({...dynamicAnswers, [field.text]: e.target.value})}
                                          rows={field.type === 'textarea' ? 4 : 3}
                                          className="resize-y pb-12"
                                          placeholder="AI will generate this..."
                                        />
                                        <div className="absolute bottom-3 left-3">
                                          <VoiceRecorder 
                                            onTranscriptionComplete={(text) => {
                                              setDynamicAnswers(prev => {
                                                const currentVal = prev[field.text] || ''
                                                const newVal = currentVal ? `${currentVal} ${text}` : text
                                                return {...prev, [field.text]: newVal}
                                              })
                                            }} 
                                          />
                                        </div>
                                      </div>
                                    )}
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
                              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                              <p>Select a Feedback Form above to start.</p>
                           </div>
                        )}

                        {error && (
                           <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
                              {error}
                           </div>
                        )}
                     </div>
                  )}
               </div>
               
               <div className="p-6 border-t border-border/40 bg-card/20 flex justify-between items-center backdrop-blur-sm">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                     {selectedCandidate && selectedTemplate ? 'Ready to submit' : 'Select candidate & template'}
                  </span>
                  <Button 
                     onClick={handleSubmit} 
                     disabled={!selectedCandidate || !selectedTemplate || submitting || analysisLoading}
                     className="min-w-[160px] rounded-full"
                  >
                     {submitting ? 'Submitting...' : 'Submit to Lever'}
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size={32} className="text-primary" />
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  )
}
