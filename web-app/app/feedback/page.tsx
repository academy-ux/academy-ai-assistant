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
import { Spinner } from '@/components/ui/spinner'
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
  alternativeRatings?: { rating: string; reasoning: string }[]
  answers?: Record<string, string> // New dynamic field map
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
  text: string // Job title
  team: string
  location: string
}

interface TemplateField {
  text: string
  description?: string
  required: boolean
  type: string // "text", "textarea", "score-system", "yes-no", etc.
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

  // State
  const [transcript, setTranscript] = useState('')
  const [transcriptFileName, setTranscriptFileName] = useState('')
  const [transcriptLoading, setTranscriptLoading] = useState(true)
  const [transcriptError, setTranscriptError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [countdown, setCountdown] = useState(30)

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // Lever data
  const [postings, setPostings] = useState<Posting[]>([])
  const [postingsLoading, setPostingsLoading] = useState(true)
  const [selectedPosting, setSelectedPosting] = useState('')
  const [postingOpen, setPostingOpen] = useState(false)
  
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [candidateOpen, setCandidateOpen] = useState(false)
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  
  // Dynamic form state (maps field text to value)
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, any>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')

  const meetingTitle = searchParams.get('title') || ''
  const meetingCode = searchParams.get('meeting') || ''

  // Load postings and templates on mount
  useEffect(() => {
    if (session) {
      loadPostings()
      loadTemplates()
    }
  }, [session])

  // Load candidates when posting is selected
  useEffect(() => {
    if (selectedPosting) {
      loadCandidates(selectedPosting)
      setSelectedCandidate('') // Reset candidate selection
    }
  }, [selectedPosting])

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

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate) || null
      setCurrentTemplate(template)
      // Reset answers when template changes
      setDynamicAnswers({})
    }
  }, [selectedTemplate, templates])

  async function analyzeTranscript(text: string) {
    setAnalysisLoading(true)
    try {
      // Pass the current template structure to the AI so it knows what fields to fill
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
          template: templateContext // New: Send template schema
        }),
      })
      const data = await res.json()

      if (data.success) {
        setAnalysis(data.analysis)
        
        // Map AI analysis to dynamic form fields
        if (data.analysis.answers) {
           setDynamicAnswers(data.analysis.answers)
        } else {
           // Fallback for old/default schema
           setDynamicAnswers({
             // We'll map standard fields to potential template matches loosely
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
      console.log('Postings loaded:', data)
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
      // Format answers for Lever API
      // Lever expects an array of { text: "Question", value: "Answer" } or structured scores
      const formattedFeedback = {
         answers: Object.entries(dynamicAnswers).map(([key, value]) => ({
            text: key,
            value: value
         })),
         // Also include raw data for our Supabase backup
         raw: dynamicAnswers
      }

      const res = await fetch('/api/lever/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedCandidate,
          templateId: selectedTemplate,
          feedback: formattedFeedback, // Send dynamic structure
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
                  <Spinner variant="infinite" size={48} className="text-primary" />
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
                {/* Selection Flow: Posting -> Candidate -> Template */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {/* Step 1: Select Opportunity (Posting/Job) */}
                   <div className="space-y-2">
                      <Label>1. Opportunity (Job)</Label>
                      <Popover open={postingOpen} onOpenChange={setPostingOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={postingOpen}
                            className="w-full justify-between"
                            disabled={postingsLoading}
                          >
                            {postingsLoading
                              ? "Loading jobs..."
                              : selectedPosting
                              ? postings.find((p) => p.id === selectedPosting)?.text
                              : "Select job..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search jobs..." />
                            <CommandList>
                              <CommandEmpty>
                                {postings.length === 0 ? "No jobs in Lever." : "No match found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {postings.map((posting) => (
                                  <CommandItem
                                    key={posting.id}
                                    value={`${posting.text} ${posting.team} ${posting.location}`}
                                    onSelect={() => {
                                      setSelectedPosting(posting.id)
                                      setPostingOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedPosting === posting.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{posting.text}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {posting.team} {posting.location && `• ${posting.location}`}
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
                   
                   {/* Step 2: Select Candidate */}
                   <div className="space-y-2">
                      <Label>2. Candidate</Label>
                      <Popover open={candidateOpen} onOpenChange={setCandidateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={candidateOpen}
                            className="w-full justify-between"
                            disabled={!selectedPosting || candidatesLoading}
                          >
                            {candidatesLoading ? (
                              "Loading..."
                            ) : selectedCandidate ? (
                              candidates.find((c) => c.id === selectedCandidate)?.name
                            ) : (
                              selectedPosting ? "Select candidate..." : "Select job first"
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search candidate..." />
                            <CommandList>
                              <CommandEmpty>
                                {candidates.length === 0 ? "No candidates for this job." : "No match found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {candidates.map((candidate) => (
                                  <CommandItem
                                    key={candidate.id}
                                    value={`${candidate.name} ${candidate.stage}`}
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
                                        <span className="text-primary/80">{candidate.stage}</span>
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
                   
                   {/* Step 3: Select Feedback Form */}
                   <div className="space-y-2">
                      <Label>3. Feedback Form</Label>
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
                              : "Select form..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Search form..." />
                            <CommandList>
                              <CommandEmpty>No forms found.</CommandEmpty>
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
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground min-h-[400px]">
                    <Spinner variant="infinite" size={64} className="text-primary" />
                    <p className="font-medium animate-pulse">
                      Analyzing transcript based on "{currentTemplate?.name || 'Default'}" form...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                      {/* Dynamic Form Rendering */}
                      {currentTemplate ? (
                         <div className="space-y-6">
                            <div className="bg-muted/20 p-4 rounded-md border border-border/50 text-sm text-muted-foreground mb-6">
                               <p className="font-medium text-foreground mb-1">Instructions</p>
                               {currentTemplate.instructions || "Please fill out the feedback form below."}
                            </div>

                            {currentTemplate.fields.map((field, idx) => (
                               <div key={idx} className="space-y-3">
                                  <Label className="text-base">
                                     {field.text}
                                     {field.required && <span className="text-primary ml-1">*</span>}
                                  </Label>
                                  {field.description && (
                                     <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                                  )}
                                  
                                  {/* Render input based on type */}
                                  {(field.type === 'score-system' || field.text.toLowerCase().includes('rating')) ? (
                                     <Select 
                                        value={dynamicAnswers[field.text] || ''} 
                                        onValueChange={(val) => setDynamicAnswers({...dynamicAnswers, [field.text]: val})}
                                     >
                                        <SelectTrigger>
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
                                     <Textarea 
                                        value={dynamicAnswers[field.text] || ''}
                                        onChange={(e) => setDynamicAnswers({...dynamicAnswers, [field.text]: e.target.value})}
                                        rows={field.type === 'textarea' ? 4 : 2}
                                        className="resize-y"
                                        placeholder="AI will generate this..."
                                     />
                                  )}
                               </div>
                            ))}
                         </div>
                      ) : (
                         <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                            <p>Select a Feedback Form (Template) above to start.</p>
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
