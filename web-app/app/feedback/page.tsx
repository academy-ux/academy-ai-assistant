'use client'

import { useSession, signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState, Suspense } from 'react'
import { Check, ChevronsUpDown, Search, FileText, User, ClipboardList, CheckCircle, ChevronRight, Calendar, X, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ParsedTitle } from '@/components/ui/parsed-title'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoiceRecorder } from '@/components/voice-recorder'
import { MagicWandIcon } from '@/components/icons/magic-wand'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type TranscriptLine = { id: string; timestamp: string | null; speaker: string | null; content: string }

function formatTranscript(text: string): TranscriptLine[] {
  if (!text) return []

  // Remove Tactiq header if present (can be long / multi-line)
  let cleanText = text.replace(
    /^Transcript delivered by Tactiq\.io[\s\S]*?(?=(\*\s*\d{1,2}:\d{2}|\bTranscript\b\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}\s+[A-Za-z]))/i,
    ''
  )
  cleanText = cleanText.trim()

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
  if (headers.length === 0) {
    return [{ id: 'line-0', timestamp: null, speaker: null, content: cleanText }]
  }

  const result: TranscriptLine[] = []

  const pushPlain = (content: string) => {
    const trimmed = content.replace(/\s+/g, ' ').trim()
    if (!trimmed) return
    result.push({ id: `line-${result.length}`, timestamp: null, speaker: null, content: trimmed })
  }

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

    if (!speaker || !rawContent) {
      pushPlain(rawContent)
      continue
    }

    result.push({ id: `line-${result.length}`, timestamp: ts, speaker, content: rawContent })
  }

  return result.length > 0 ? result : [{ id: 'line-0', timestamp: null, speaker: null, content: cleanText }]
}

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
  id: string
  text: string
  description?: string
  required: boolean
  type: string
  options?: any[]
}

interface Template {
  id: string
  name: string
  instructions: string
  fields: TemplateField[]
}

interface Interview {
  id: string
  candidate_name: string
  interviewer?: string
  position: string
  meeting_title: string
  meeting_type?: string | null
  meeting_date?: string
  transcript: string
  created_at: string
  // Optional: present for Lever-linked interviews
  candidate_id?: string | null
  submitted_at?: string | null
}

function initialsFrom(label: string) {
  const parts = (label || 'U')
    .trim()
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
  return parts.map((p) => p[0]!.toUpperCase()).join('') || 'U'
}

function formatRoleAndCompany(position?: string) {
  if (!position) return { role: '', company: '' }
  const raw = position.trim()

  if (raw.includes('•')) {
    const [role, ...rest] = raw.split('•')
    return { role: role.trim(), company: rest.join('•').trim() }
  }

  const separators = [' - ', ' — ', ' – ', ' @ ', ' | ']
  const sep = separators.find(s => raw.includes(s))
  if (!sep) return { role: raw, company: '' }

  const parts = raw.split(sep).map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return { role: raw, company: '' }

  const looksLikeRole = (s: string) =>
    /(designer|design|engineer|product|manager|lead|founding|director|vp|marketing|sales|research|ops|data|frontend|backend|full[- ]?stack)/i.test(s)

  const [a, b] = [parts[0], parts.slice(1).join(sep).trim()]
  const aIsRole = looksLikeRole(a)
  const bIsRole = looksLikeRole(b)

  if (aIsRole && !bIsRole) return { role: a, company: b }
  if (!aIsRole && bIsRole) return { role: b, company: a }
  return { role: a, company: b }
}

function FeedbackContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectInterviewId = searchParams.get('interviewId')
  const hasAutoSelectedInterviewRef = useRef(false)
  const lastAutoAnalyzeKeyRef = useRef<string | null>(null)
  const lastAutoTemplateKeyRef = useRef<string | null>(null)
  const manualTemplateInterviewIdRef = useRef<string | null>(null)
  const analysisCacheRef = useRef<
    Map<
      string,
      {
        analysis: Analysis
        incomingAnswers: Record<string, any> | null
      }
    >
  >(new Map())
  // Store form state per interview+template combination so switching templates preserves data
  const templateStateRef = useRef<
    Map<
      string, // key: `${interviewId}:${templateId}`
      {
        dynamicAnswers: Record<string, any>
        aiGeneratedFields: Record<string, boolean>
        analysis: Analysis | null
      }
    >
  >(new Map())
  const activeAnalyzeAbortRef = useRef<AbortController | null>(null)
  const analyzeRunIdRef = useRef(0)
  const isAnalyzingRef = useRef(false)

  // Interview selection state
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [interviewsLoading, setInterviewsLoading] = useState(true)
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)
  const [interviewSearch, setInterviewSearch] = useState('')

  const [transcript, setTranscript] = useState('')
  const [transcriptFileName, setTranscriptFileName] = useState('')

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [aiGeneratedFields, setAiGeneratedFields] = useState<Record<string, boolean>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitDbStatus, setSubmitDbStatus] = useState<{ updated?: boolean; inserted?: boolean; error?: string } | null>(null)
  const [error, setError] = useState('')

  const viewerInitials = initialsFrom(session?.user?.name || session?.user?.email || '')

  const isViewerSpeaker = (speaker?: string | null) => {
    if (!speaker) return false
    const s = speaker.toLowerCase().trim()
    const name = session?.user?.name?.toLowerCase().trim()
    if (name) {
      if (s === name) return true
      const tokens = name.split(/\s+/).filter(Boolean)
      const first = tokens[0]
      const last = tokens.length > 1 ? tokens[tokens.length - 1] : null
      if (first && s.includes(first) && (!last || s.includes(last))) return true
    }
    const emailLocal = session?.user?.email?.split('@')[0]?.toLowerCase()
    if (emailLocal && s.replace(/\s+/g, '').includes(emailLocal.replace(/[._-]/g, ''))) return true
    return false
  }

  const isOptionField = (f: TemplateField) => {
    const t = String(f.type || '').toLowerCase()
    return t === 'score-system' || t === 'score' || t === 'dropdown' || t === 'multiple-choice' || t === 'yes-no'
  }

  const optionTextsFor = (f: TemplateField) => {
    const opts = Array.isArray(f.options) ? f.options : []
    const texts = opts
      .map((o: any) => (o && typeof o === 'object' ? (o.text ?? o.optionId ?? o.value) : o))
      .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
    return Array.from(new Set(texts))
  }

  const validateField = (f: TemplateField, value: any) => {
    const t = String(f.type || '').toLowerCase()
    const isScoreSystem = t === 'score-system'
    const requiredByLever = !!f.required || isScoreSystem

    if (requiredByLever) {
      const blank =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0) ||
        (value === '?' && isOptionField(f))
      if (blank) return 'Required'
    }

    if (isOptionField(f)) {
      if (value === '?' || value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        return null
      }

      if (t === 'yes-no') {
        const v = typeof value === 'string' ? value.toLowerCase() : ''
        if (v !== 'yes' && v !== 'no') return 'Please select a valid option'
      }

      const optionTexts = optionTextsFor(f)
      if (optionTexts.length > 0 && typeof value === 'string' && !optionTexts.includes(value)) {
        return 'Please select a valid option'
      }
    }

    return null
  }

  const validateAllFields = (template: Template | null, answers: Record<string, any>) => {
    if (!template) return {}
    const errors: Record<string, string> = {}
    for (const f of template.fields || []) {
      const msg = validateField(f, answers[f.text])
      if (msg) errors[f.text] = msg
    }
    return errors
  }

  // Track if we've already polled for new transcripts this session
  const hasPolledForNewTranscriptRef = useRef(false)
  const [pollingForTranscript, setPollingForTranscript] = useState(false)
  const [pollingError, setPollingError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      loadInterviews()
      loadPostings()
      loadTemplates()
      
      // Auto-poll for new transcripts on page load (but only once per session)
      if (!hasPolledForNewTranscriptRef.current) {
        hasPolledForNewTranscriptRef.current = true
        // Silent poll in the background (fast mode)
        pollForNewTranscript(true)
      }
    }
  }, [session])

  // Poll Drive for new transcripts
  // @param silent - If true, don't show loading UI or errors (for background polling)
  async function pollForNewTranscript(silent: boolean = false) {
    console.log('[Feedback] Polling Drive for new transcripts... (silent:', silent, ')')
    if (!silent) {
      setPollingForTranscript(true)
      setPollingError(null)
    }
    
    try {
      const res = await fetch('/api/poll-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fastMode: true,
          includeSubfolders: true 
        })
      })
      
      if (res.ok) {
        const result = await res.json()
        console.log('[Feedback] Drive poll result:', result)
        
        // Show success message if not silent and files were imported
        if (!silent && result.imported > 0) {
          console.log(`[Feedback] ✓ Imported ${result.imported} new transcript(s)`)
          toast.success(`Imported ${result.imported} new transcript${result.imported > 1 ? 's' : ''}`)
        }
        
        // Always reload interviews after polling to get latest
        const interviewsRes = await fetch('/api/interviews?limit=100&offset=0')
        const interviewsData = await interviewsRes.json()
        
        if (interviewsData.interviews && interviewsData.interviews.length > 0) {
          const newInterviews = interviewsData.interviews as Interview[]
          setInterviews(newInterviews)
          
          // If we imported new transcripts and no interview is selected, select the newest one
          if (result.imported > 0 && !selectedInterview) {
            const newest = newInterviews[0] // Interviews are sorted by date, newest first
            if (newest) {
              selectInterview(newest)
              console.log('[Feedback] Auto-selected newest transcript:', newest.meeting_title)
            }
          }
        }
        
        // Show no new files message if manual poll
        if (!silent && result.imported === 0) {
          console.log('[Feedback] No new transcripts found')
          toast.info('No new transcripts found')
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.error || 'Drive poll failed'
        console.log('[Feedback] Drive poll not configured or failed:', res.status, errorMsg)
        if (!silent) {
          setPollingError(errorMsg)
        }
      }
    } catch (err: any) {
      console.log('[Feedback] Drive poll error:', err)
      if (!silent) {
        setPollingError('Network error while polling Drive')
      }
    } finally {
      if (!silent) {
        setPollingForTranscript(false)
      }
    }
  }

  // Reset validation state when template/interview changes
  useEffect(() => {
    setFieldErrors({})
    setTouchedFields({})
    setSubmitAttempted(false)
  }, [selectedInterview?.id, selectedTemplate])

  // #region agent log (hypothesis B/C/E)
  useEffect(() => {
    if (!templates || templates.length === 0) return
    const selected = templates.find(t => t.id === selectedTemplate)
    fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'B',location:'web-app/app/feedback/page.tsx:selectedTemplateEffect',message:'Selected template changed / observed',data:{selectedTemplateId:selectedTemplate||null,selectedTemplateName:selected?.name||null,selectedTemplateIsOld:/\\bold\\b/i.test(String(selected?.name||'')),templateCount:templates.length,firstTemplates:templates.slice(0,6).map(t=>({id:t.id,name:t.name}))},timestamp:Date.now()})}).catch(()=>{});
  }, [selectedTemplate, templates])
  // #endregion

  // #region agent log (hypothesis A/B)
  useEffect(() => {
    if (templatesLoading) return
    fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'A',location:'web-app/app/feedback/page.tsx:templatesLoadingEffect',message:'Templates loading finished',data:{templatesLoading,templateCount:templates.length,selectedTemplateId:selectedTemplate||null,selectedTemplateName:templates.find(t=>t.id===selectedTemplate)?.name||null},timestamp:Date.now()})}).catch(()=>{});
  }, [templatesLoading])
  // #endregion

  useEffect(() => {
    if (!session) return
    if (!preselectInterviewId) return
    if (hasAutoSelectedInterviewRef.current) return
    if (selectedInterview?.id === preselectInterviewId) {
      hasAutoSelectedInterviewRef.current = true
      return
    }

    const run = async () => {
      try {
        // Prefer selecting from the loaded list (fast)
        const inList = interviews.find(i => i.id === preselectInterviewId)
        if (inList) {
          selectInterview(inList)
          hasAutoSelectedInterviewRef.current = true
          return
        }

        // Fallback: fetch the interview directly (handles >100 interviews, etc.)
        const res = await fetch(`/api/interviews/${preselectInterviewId}`)
        if (!res.ok) return
        const interview = await res.json()

        // Ensure it appears in the left list and is selected
        setInterviews(prev => [interview, ...prev.filter(p => p.id !== interview.id)])
        selectInterview(interview)
        hasAutoSelectedInterviewRef.current = true
      } catch (e) {
        console.error('Failed to preselect interview:', e)
      }
    }

    run()
  }, [session, preselectInterviewId, interviews, selectedInterview])

  useEffect(() => {
    if (selectedPosting) {
      loadCandidates(selectedPosting)
      setSelectedCandidate('')
    }
  }, [selectedPosting])

  async function loadInterviews() {
    setInterviewsLoading(true)
    try {
      const res = await fetch('/api/interviews?limit=100&offset=0')
      const data = await res.json()
      if (data.interviews) {
        setInterviews(() => {
          const base = data.interviews as Interview[]
          if (selectedInterview && !base.some(i => i.id === selectedInterview.id)) {
            return [selectedInterview, ...base]
          }
          return base
        })
      }
    } catch (err) {
      console.error('Failed to load interviews:', err)
    } finally {
      setInterviewsLoading(false)
    }
  }

  function selectInterview(interview: Interview) {
    // Selecting a new meeting should reset derived state so we can re-analyze cleanly.
    lastAutoAnalyzeKeyRef.current = null
    lastAutoTemplateKeyRef.current = null
    manualTemplateInterviewIdRef.current = null
    // Cancel any in-flight analysis so the new meeting can analyze immediately.
    try {
      activeAnalyzeAbortRef.current?.abort()
    } catch {}
    activeAnalyzeAbortRef.current = null
    setAnalysisLoading(false)
    setError('')
    setSubmitSuccess(false)
    setSubmitDbStatus(null)
    // Clear current state - will be restored from templateStateRef if exists for this interview+template
    setAnalysis(null)
    setDynamicAnswers({})
    setAiGeneratedFields({})

    // Reset Lever selections so we can auto-pick the correct Opportunity/Candidate for this meeting.
    setSelectedPosting('')
    setSelectedCandidate('')
    setCandidates([])

    setSelectedInterview(interview)
    setTranscript(interview.transcript)
    setTranscriptFileName(interview.meeting_title || interview.id)
  }

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate) || null
      setCurrentTemplate(template)
      
      // If we have an interview+template combination, try to restore saved state
      if (selectedInterview?.id && selectedTemplate) {
        const stateKey = `${selectedInterview.id}:${selectedTemplate}`
        const savedState = templateStateRef.current.get(stateKey)
        
        if (savedState) {
          // Restore saved state for this template
          setDynamicAnswers(savedState.dynamicAnswers)
          setAiGeneratedFields(savedState.aiGeneratedFields)
          setAnalysis(savedState.analysis)
        } else {
          // New template for this interview - start fresh
          setDynamicAnswers({})
          setAiGeneratedFields({})
          setAnalysis(null)
          lastAutoAnalyzeKeyRef.current = null
        }
      } else {
        // No interview selected - clear everything
        setDynamicAnswers({})
        setAiGeneratedFields({})
        setAnalysis(null)
        lastAutoAnalyzeKeyRef.current = null
      }
      
      // Cancel any in-flight analysis so the new template can analyze immediately.
      try {
        activeAnalyzeAbortRef.current?.abort()
      } catch {}
      activeAnalyzeAbortRef.current = null
      setAnalysisLoading(false)

      // #region agent log (hypothesis F)
      fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run3',hypothesisId:'F',location:'web-app/app/feedback/page.tsx:selectedTemplate->currentTemplateEffect',message:'Set currentTemplate from selectedTemplate',data:{selectedTemplateId:selectedTemplate,selectedTemplateName:templates.find(t=>t.id===selectedTemplate)?.name||null,foundTemplateId:template?.id||null,foundTemplateName:template?.name||null,foundIsOld:/\\bold\\b/i.test(String(template?.name||'').toLowerCase()),templatesCount:templates.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  }, [selectedTemplate, templates, selectedInterview])

  // Auto-save current form state when it changes
  useEffect(() => {
    if (selectedInterview?.id && selectedTemplate) {
      const stateKey = `${selectedInterview.id}:${selectedTemplate}`
      templateStateRef.current.set(stateKey, {
        dynamicAnswers,
        aiGeneratedFields,
        analysis
      })
    }
  }, [dynamicAnswers, aiGeneratedFields, analysis, selectedInterview, selectedTemplate])

  function normalizeQuestionKey(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function hashString32(input: string) {
    // Fast non-crypto hash for client-side caching.
    let hash = 2166136261
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(16)
  }

  function buildAnalysisCacheKey(interviewId: string, templateId: string, fullTranscript: string) {
    return `${interviewId}:${templateId}:${fullTranscript.length}:${hashString32(fullTranscript)}`
  }

  function mergeIncomingAnswers(
    prev: Record<string, any>,
    incoming: Record<string, any>,
    template: Template
  ): { next: Record<string, any>; filledKeys: string[] } {
    const next = { ...prev }
    const filledKeys: string[] = []

    const fieldKeyByNormalized = new Map<string, string>()
    const fieldTypeByKey = new Map<string, string>()
    for (const f of template.fields) {
      fieldKeyByNormalized.set(normalizeQuestionKey(f.text), f.text)
      fieldTypeByKey.set(f.text, String(f.type || '').toLowerCase())
    }

    for (const [k, v] of Object.entries(incoming)) {
      if (k === 'candidateName' || k === 'answers') continue
      const mappedKey = fieldKeyByNormalized.get(normalizeQuestionKey(k)) || k
      const existing = (next as any)[mappedKey]
      const isEmpty = existing === undefined || existing === null || String(existing).trim() === ''
      if (isEmpty) {
        // Normalize values based on field type for button matching
        const fieldType = fieldTypeByKey.get(mappedKey)
        let normalizedValue = v
        
        if (fieldType === 'score') {
          // Score fields expect '1', '2', '3', or '4'
          if (typeof v === 'number') {
            normalizedValue = String(v)
          } else if (typeof v === 'string') {
            const lower = v.toLowerCase().trim()
            // Handle AI returning yes/no for score fields
            if (lower === 'yes') normalizedValue = '4'  // Map yes to highest score
            else if (lower === 'no') normalizedValue = '1'  // Map no to lowest score
            else normalizedValue = v.trim()
          }
        } else if (fieldType === 'yes-no') {
          // Ensure yes-no fields have lowercase values
          if (typeof v === 'string') {
            const lower = v.toLowerCase().trim()
            if (lower === 'yes' || lower === 'no') normalizedValue = lower
            else normalizedValue = v.trim()
          }
        }
        
        ;(next as any)[mappedKey] = normalizedValue
        filledKeys.push(mappedKey)
      }
    }

    // Ensure every field has a value; if unknown, use "?" (but never overwrite user edits).
    for (const f of template.fields) {
      const existing = (next as any)[f.text]
      const isEmpty = existing === undefined || existing === null || String(existing).trim() === ''
      if (isEmpty) {
        ;(next as any)[f.text] = '?'
        filledKeys.push(f.text)
      }
    }

    return { next, filledKeys }
  }

  // Auto-run analysis once we have BOTH transcript + template (fills every question)
  useEffect(() => {
    if (!selectedInterview) return
    if (!transcript) return
    if (!currentTemplate) return
    
    // Don't auto-analyze if already analyzing (user clicked button)
    if (analysisLoading) {
      return
    }

    const key = `${selectedInterview.id}:${currentTemplate.id}`
    
    // Check if we've already auto-analyzed this combination
    if (lastAutoAnalyzeKeyRef.current === key) return
    
    // Check if we have a cached result for this combination
    const cacheKey = buildAnalysisCacheKey(selectedInterview.id, currentTemplate.id, transcript)
    const cached = analysisCacheRef.current.get(cacheKey)
    if (cached) {
      lastAutoAnalyzeKeyRef.current = key
      return
    }

    // Only auto-analyze if we don't have results yet
    analyzeTranscript(transcript, currentTemplate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterview?.id, transcript, currentTemplate?.id, analysisLoading])

  async function analyzeTranscript(text: string, templateOverride?: Template | null) {
    // Prevent concurrent analysis requests
    if (isAnalyzingRef.current) {
      return
    }
    
    const effectiveTemplate = templateOverride ?? currentTemplate
    const effectiveInterview = selectedInterview

    const cacheKey =
      effectiveInterview?.id && effectiveTemplate?.id
        ? buildAnalysisCacheKey(effectiveInterview.id, effectiveTemplate.id, text)
        : null
    
    // If we've already analyzed this transcript+template once, reuse it.
    if (cacheKey) {
      const cached = analysisCacheRef.current.get(cacheKey)
      if (cached) {
        setError('')
        setAnalysis(cached.analysis)
        if (effectiveInterview?.id && effectiveTemplate?.id) {
          lastAutoAnalyzeKeyRef.current = `${effectiveInterview.id}:${effectiveTemplate.id}`
        }

        if (cached.incomingAnswers && effectiveTemplate) {
          const { next, filledKeys } = mergeIncomingAnswers(dynamicAnswers, cached.incomingAnswers, effectiveTemplate)
          setDynamicAnswers(next)
          if (filledKeys.length > 0) {
            setAiGeneratedFields(prevFlags => {
              const flags = { ...prevFlags }
              for (const k of filledKeys) flags[k] = true
              return flags
            })
          }
        }
        return
      }
    }

    // Mark analysis as in progress
    isAnalyzingRef.current = true
    
    // Set loading state ONLY if not already loading (button may have set it already)
    if (!analysisLoading) {
      setAnalysisLoading(true)
    }
    setError('')
    
    // Track start time for minimum loading duration
    const startTime = Date.now()
    const MIN_LOADING_MS = 1500 // Ensure spinner is visible for at least 1.5 seconds
    
    // CRITICAL: Use setTimeout to break out of current execution context
    // This allows React to render the loading state before API call
    await new Promise(resolve => setTimeout(resolve, 200))
    
    try {
      // Abort any previous in-flight analysis to avoid stale results overwriting state.
      analyzeRunIdRef.current += 1
      const runId = analyzeRunIdRef.current
      try {
        activeAnalyzeAbortRef.current?.abort()
      } catch {}
      const controller = new AbortController()
      activeAnalyzeAbortRef.current = controller

      // Keep payloads reasonable for the model; extremely long transcripts can fail.
      const MAX_ANALYSIS_CHARS = 60000
      const analysisTranscript =
        text.length > MAX_ANALYSIS_CHARS
          ? `${text.slice(0, 45000)}\n\n[... transcript truncated for analysis ...]\n\n${text.slice(-15000)}`
          : text

      const templateContext = effectiveTemplate ? {
        fields: effectiveTemplate.fields.map(f => ({
          question: f.text,
          description: f.description,
          type: f.type
        }))
      } : null

      // #region agent log (hypothesis G)
      fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run3',hypothesisId:'G',location:'web-app/app/feedback/page.tsx:analyzeTranscript:beforeFetch',message:'Calling /api/analyze',data:{interviewId:selectedInterview?.id||null,selectedTemplateId:selectedTemplate||null,selectedTemplateName:templates.find(t=>t.id===selectedTemplate)?.name||null,currentTemplateId:currentTemplate?.id||null,currentTemplateName:currentTemplate?.name||null,currentTemplateIsOld:/\\bold\\b/i.test(String(currentTemplate?.name||'').toLowerCase()),templateFieldCount:currentTemplate?.fields?.length||0,analysisTranscriptLength:analysisTranscript.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          transcript: analysisTranscript,
          meetingTitle: selectedInterview?.meeting_title || '',
          meetingDate: selectedInterview?.meeting_date || new Date().toLocaleDateString(),
          template: templateContext
        }),
      })
      const data = await res.json()

      // If a newer analysis run started, ignore this result.
      if (runId !== analyzeRunIdRef.current) return

      if (!res.ok || !data?.success) {
        const msg = data?.error || data?.message || 'Analysis failed'
        
        // Special handling for rate limit
        if (res.status === 429) {
          setError('Rate limit exceeded. Please wait a minute before analyzing again.')
        } else {
          setError(msg)
        }
        // Allow auto-analysis to retry if it failed (rate-limit, auth, etc.)
        lastAutoAnalyzeKeyRef.current = null
        return
      }

      if (data.success) {
        setAnalysis(data.analysis)
        if (effectiveInterview?.id && effectiveTemplate?.id) {
          lastAutoAnalyzeKeyRef.current = `${effectiveInterview.id}:${effectiveTemplate.id}`
        }
        
        // Gemini sometimes returns either:
        // 1) { candidateName, answers: { "<question>": "<answer>" } }
        // 2) { "<question>": "<answer>", ... } (flat)
        const incomingFromApi: unknown = data?.analysis?.answers
        const incomingFlat: unknown = data?.analysis

        const candidateNameFromApi =
          (data?.analysis && typeof data.analysis === 'object' && data.analysis?.candidateName) ? data.analysis.candidateName : null

        const extractIncomingAnswers = (): Record<string, any> | null => {
          if (incomingFromApi && typeof incomingFromApi === 'object' && !Array.isArray(incomingFromApi)) {
            return incomingFromApi as Record<string, any>
          }

          // If the response is a flat object, only treat it as "answers" if it overlaps
          // with the current template fields (to avoid accidentally using legacy keys).
          if (incomingFlat && typeof incomingFlat === 'object' && !Array.isArray(incomingFlat)) {
            const flat = incomingFlat as Record<string, any>
            const flatKeys = Object.keys(flat).filter(k => k !== 'candidateName' && k !== 'answers')
            if (!currentTemplate?.fields?.length) return null
            const fieldKeyByNormalized = new Map<string, string>()
            for (const f of currentTemplate.fields) fieldKeyByNormalized.set(normalizeQuestionKey(f.text), f.text)
            const overlap = flatKeys.filter(k => fieldKeyByNormalized.has(normalizeQuestionKey(k))).length
            if (overlap > 0) return flat
          }

          return null
        }

        const incoming = extractIncomingAnswers()

        if (incoming) {
          if (effectiveTemplate) {
            const { next, filledKeys } = mergeIncomingAnswers(dynamicAnswers, incoming, effectiveTemplate)
            setDynamicAnswers(next)
            if (filledKeys.length > 0) {
              setAiGeneratedFields(prevFlags => {
                const flags = { ...prevFlags }
                for (const k of filledKeys) flags[k] = true
                return flags
              })
            }
          }

          // Back-compat fallback for older analyzer responses
          setDynamicAnswers(prev => ({
            ...prev,
            ...(prev['Overall Rating'] ? {} : { "Overall Rating": data.analysis.rating }),
            ...(prev['Strengths'] ? {} : { "Strengths": data.analysis.strengths }),
            ...(prev['Concerns'] ? {} : { "Concerns": data.analysis.concerns }),
            ...(prev['Technical Skills'] ? {} : { "Technical Skills": data.analysis.technicalSkills }),
            ...(prev['Cultural Fit'] ? {} : { "Cultural Fit": data.analysis.culturalFit }),
            ...(prev['Recommendation'] ? {} : { "Recommendation": data.analysis.recommendation }),
          }))
        }

          // Cache for this transcript+template so we don't re-analyze again.
          if (cacheKey) {
            analysisCacheRef.current.set(cacheKey, { analysis: data.analysis, incomingAnswers: incoming })
          }

        if (candidateNameFromApi) {
          autoMatchCandidate(candidateNameFromApi)
        }
      }
    } catch (err: any) {
      // Ignore intentional aborts when switching interviews/templates.
      if (err?.name === 'AbortError') {
        // Don't return - let finally block handle cleanup
      } else {
        setError('Analysis failed: ' + err.message)
        lastAutoAnalyzeKeyRef.current = null
      }
    } finally {
      // Ensure loading spinner is visible for minimum duration
      const elapsed = Date.now() - startTime
      const remaining = MIN_LOADING_MS - elapsed
      
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }
      
      isAnalyzingRef.current = false
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

        // IMPORTANT: do NOT use normalizeForMatch() here because it strips parentheticals,
        // which would turn "Phone Screen (old)" into "phone screen".
        const isOldTemplate = (name?: string) => /\bold\b/i.test(String(name || '').toLowerCase())

        const isPhoneScreenTemplate = (name?: string) =>
          normalizeForMatch(name || '').includes('phone screen')

        // #region agent log (hypothesis A/B/C)
        fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'web-app/app/feedback/page.tsx:loadTemplates',message:'Templates loaded',data:{count:Array.isArray(data.templates)?data.templates.length:null,phoneScreenLike:(Array.isArray(data.templates)?data.templates.filter((t:any)=>String(t?.name||'').toLowerCase().includes('phone screen')).slice(0,6).map((t:any)=>({id:t.id,name:t.name,normalized:normalizeForMatch(String(t?.name||'')),isOld:isOldTemplate(String(t?.name||''))})):null),selectedTemplateAtLoad:selectedTemplate},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        // Default: prefer "Phone Screen" but NEVER auto-select "(old)" templates.
        const phoneScreenTemplate = data.templates.find((t: Template) =>
          isPhoneScreenTemplate(t.name) && !isOldTemplate(t.name)
        )

        const interviewTemplate = data.templates.find((t: Template) =>
          normalizeForMatch(t.name || '').includes('interview') && !isOldTemplate(t.name)
        )

        const firstNonOldTemplate = data.templates.find((t: Template) => !isOldTemplate(t.name))

        const defaultTemplateId =
          phoneScreenTemplate?.id ||
          interviewTemplate?.id ||
          firstNonOldTemplate?.id ||
          (data.templates.length > 0 ? data.templates[0].id : '')

        if (defaultTemplateId) {
          // Avoid overriding a user's manual choice, but ensure we don't stick on an "(old)" default.
          // Use a functional update so we don't rely on a stale `selectedTemplate` closure.
          setSelectedTemplate(prev => {
            if (!prev) return defaultTemplateId
            const prevTemplate = data.templates.find((t: Template) => t.id === prev)
            const prevIsOld = prevTemplate ? isOldTemplate(prevTemplate.name) : false
            // #region agent log (hypothesis A/C)
            fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'web-app/app/feedback/page.tsx:loadTemplates:setSelectedTemplate',message:'Default template decision',data:{prevTemplateId:prev,prevTemplateName:prevTemplate?.name||null,prevNormalized:prevTemplate?normalizeForMatch(prevTemplate.name):null,prevIsOld,defaultTemplateId,defaultTemplateName:data.templates.find((t:Template)=>t.id===defaultTemplateId)?.name||null,phoneScreenTemplateName:phoneScreenTemplate?.name||null,interviewTemplateName:interviewTemplate?.name||null,firstNonOldTemplateName:firstNonOldTemplate?.name||null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return prevIsOld ? defaultTemplateId : prev
          })
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

  function normalizeForMatch(s: string) {
    return s
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[@•|—–-]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function pickPostingFromInterview(interview: Interview) {
    if (!postings || postings.length === 0) return null
    const raw = interview.position || interview.meeting_title || ''
    const needle = normalizeForMatch(raw)
    if (!needle) return null

    // Prefer exact-ish matches on posting.text, then fall back to team keyword overlap
    let best: { id: string; score: number } | null = null

    for (const p of postings) {
      const hay = normalizeForMatch(`${p.text} ${p.team || ''} ${p.location || ''}`)
      if (!hay) continue

      // simple word overlap score
      const needleWords = new Set(needle.split(' ').filter(w => w.length > 2))
      const hayWords = new Set(hay.split(' ').filter(w => w.length > 2))
      let overlap = 0
      for (const w of needleWords) if (hayWords.has(w)) overlap++

      // bonus if company-ish token appears (e.g. "dash", "labs")
      const companyBonus = /(labs|inc|llc|corp|company|studio)/.test(needle) ? 1 : 0
      const score = overlap * 10 + companyBonus

      if (!best || score > best.score) best = { id: p.id, score }
    }

    // Require some confidence to avoid random selection
    if (!best || best.score < 12) return null
    return best.id
  }

  function pickTemplateFromInterview(interview: Interview) {
    if (!templates || templates.length === 0) return null

    const raw = `${interview.meeting_title || ''} ${interview.position || ''}`
    const needle = normalizeForMatch(raw)
    if (!needle) return null

    const needleWords = new Set(needle.split(' ').filter(w => w.length > 2))

    // #region agent log (hypothesis D)
    fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'D',location:'web-app/app/feedback/page.tsx:pickTemplateFromInterview',message:'Pick template for interview',data:{interviewId:interview?.id||null,needle,templateCount:templates.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    let best: { id: string; score: number } | null = null
    for (const t of templates) {
      const nameLower = (t.name || '').toLowerCase()
      // IMPORTANT: do NOT use normalizeForMatch() here; it strips "(old)".
      const isOld = /\bold\b/i.test(String(t.name || '').toLowerCase())
      // Never auto-select "(old)" templates.
      if (isOld) continue
      const hay = normalizeForMatch(`${t.name || ''} ${t.instructions || ''}`)
      if (!hay) continue

      const hayWords = new Set(hay.split(' ').filter(w => w.length > 2))
      let overlap = 0
      for (const w of needleWords) if (hayWords.has(w)) overlap++

      // Bonus for very common interview stages
      const stageBonus =
        (needle.includes('phone screen') && hay.includes('phone screen')) ? 10 :
        (needle.includes('screen') && hay.includes('screen')) ? 4 :
        (needle.includes('onsite') && hay.includes('onsite')) ? 6 :
        (needle.includes('portfolio') && hay.includes('portfolio')) ? 6 :
        (needle.includes('debrief') && hay.includes('debrief')) ? 6 :
        0

      const score = overlap * 10 + stageBonus
      if (!best || score > best.score) best = { id: t.id, score }
    }

    // Require some confidence to avoid random selection.
    if (!best || best.score < 12) return null
    return best.id
  }

  // Auto-select a Lever feedback template that matches the meeting (e.g. "2 - Phone Screen")
  useEffect(() => {
    if (!selectedInterview) return
    if (templatesLoading) return
    if (!templates || templates.length === 0) return
    if (manualTemplateInterviewIdRef.current === selectedInterview.id) return

    const key = `${selectedInterview.id}:${templates.length}`
    if (lastAutoTemplateKeyRef.current === key) return

    const templateId = pickTemplateFromInterview(selectedInterview)
    // Only auto-select when we have a confident match. Do not default to phone screen.
    // #region agent log (hypothesis C/D/E)
    fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'web-app/app/feedback/page.tsx:templateAutoSelectEffect',message:'Template auto-select check',data:{interviewId:selectedInterview.id,key,manualTemplateInterviewIdRef:manualTemplateInterviewIdRef.current||null,selectedTemplateBefore:selectedTemplate,computedTemplateId:templateId||null,computedTemplateName:templateId?(templates.find(t=>t.id===templateId)?.name||null):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (templateId) setSelectedTemplate(templateId)
    lastAutoTemplateKeyRef.current = key
  }, [selectedInterview, templatesLoading, templates])

  // Auto-select posting from interview when possible
  useEffect(() => {
    if (!selectedInterview) return
    if (selectedPosting) return
    if (!postings || postings.length === 0) return

    const postingId = pickPostingFromInterview(selectedInterview)
    if (postingId) setSelectedPosting(postingId)
  }, [selectedInterview, selectedPosting, postings])

  // Auto-select candidate once candidates are loaded for a posting
  useEffect(() => {
    if (!selectedInterview) return
    if (!selectedPosting) return
    if (candidatesLoading) return
    if (selectedCandidate) return
    if (!candidates || candidates.length === 0) return

    const candidateId = selectedInterview.candidate_id
    if (candidateId && candidates.some(c => c.id === candidateId)) {
      setSelectedCandidate(candidateId)
      return
    }

    if (selectedInterview.candidate_name) {
      autoMatchCandidate(selectedInterview.candidate_name)
    }
  }, [selectedInterview, selectedPosting, candidatesLoading, candidates, selectedCandidate])

  async function handleSubmit() {
    if (!selectedCandidate || !selectedTemplate) {
      setError('Please select a candidate and template')
      return
    }

    setSubmitting(true)
    setError('')
    setSubmitAttempted(true)

    const candidate = candidates.find(c => c.id === selectedCandidate)

    try {
      if (!currentTemplate) {
        setError('Please select a feedback form')
        return
      }

      const nextFieldErrors = validateAllFields(currentTemplate, dynamicAnswers)
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors)
        setError('Please fill the highlighted required fields.')
        return
      }

      const toLeverValue = (f: TemplateField, raw: any) => {
        if (raw === undefined || raw === null) return null
        if (typeof raw === 'string' && raw.trim() === '') return null

        // Lever option-based fields must match one of the option texts; "?" isn't valid there.
        if (raw === '?' && isOptionField(f)) return null

        const t = String(f.type || '').toLowerCase()
        if (isOptionField(f) && typeof raw === 'string') {
          const optionTexts = optionTextsFor(f)
          if (optionTexts.length > 0 && !optionTexts.includes(raw)) return null
          if (t === 'yes-no') {
            const v = raw.toLowerCase()
            if (v !== 'yes' && v !== 'no') return null
            return v
          }
        }

        if (f.type === 'multiple-select') {
          if (Array.isArray(raw)) return raw
          if (typeof raw === 'string') {
            const parts = raw
              .split(/[\n,]+/)
              .map(s => s.trim())
              .filter(Boolean)
            return parts.length > 0 ? parts : null
          }
        }

        return raw
      }

      const fieldValues = currentTemplate.fields
        .map((f) => {
          const value = toLeverValue(f, dynamicAnswers[f.text])
          return { id: f.id, value }
        })
        .filter((fv) => {
          if (fv.value === null || fv.value === undefined) return false
          if (typeof fv.value === 'string' && fv.value.trim() === '') return false
          if (Array.isArray(fv.value) && fv.value.length === 0) return false
          return true
        })

      // Keep the legacy summary fields for Supabase indexing/summary
      const ratingField = currentTemplate.fields.find((f) => f.type === 'score-system' || f.text.toLowerCase().includes('rating'))
      const recommendationField = currentTemplate.fields.find((f) => f.text.toLowerCase().includes('recommend'))

      const formattedFeedback = {
        rating: (ratingField ? (dynamicAnswers[ratingField.text] || '') : (dynamicAnswers['Rating'] || '')) as string,
        strengths: dynamicAnswers['Strengths'] || '',
        concerns: dynamicAnswers['Concerns'] || '',
        technicalSkills: dynamicAnswers['Technical Skills'] || '',
        culturalFit: dynamicAnswers['Cultural Fit'] || '',
        recommendation: (recommendationField ? (dynamicAnswers[recommendationField.text] || '') : (dynamicAnswers['Recommendation'] || '')) as string,
      }

      const res = await fetch('/api/lever/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedCandidate,
          templateId: selectedTemplate,
          fieldValues,
          feedback: formattedFeedback,
          transcript,
          meetingTitle: selectedInterview?.meeting_title || '',
          meetingCode: selectedInterview?.id || '',
          candidateName: candidate?.name,
          position: candidate?.position,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setSubmitSuccess(true)
        setSubmitDbStatus(data.dbStatus || null)
      } else {
        const baseMsg = data.error || data.message || 'Submission failed'
        const details =
          data.details
            ? (typeof data.details === 'string' ? data.details : JSON.stringify(data.details, null, 2))
            : ''
        setError(details ? `${baseMsg}\n\n${details}` : baseMsg)
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
            {submitDbStatus && (
              <p className="text-xs text-muted-foreground">
                {submitDbStatus.updated ? '✓ History updated' : 
                 submitDbStatus.inserted ? '✓ Added to history' :
                 submitDbStatus.error ? `⚠ History not updated: ${submitDbStatus.error}` :
                 '⚠ History status unknown'}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            <Button 
              onClick={() => window.location.href = '/history'} 
              className="w-full max-w-xs h-11 rounded-full"
            >
              View in History
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filter interviews by search
  const filteredInterviews = interviews.filter(interview => {
    const searchLower = interviewSearch.toLowerCase()
    return (
      interview.candidate_name?.toLowerCase().includes(searchLower) ||
      interview.position?.toLowerCase().includes(searchLower) ||
      interview.meeting_title?.toLowerCase().includes(searchLower) ||
      interview.interviewer?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase mb-3">Feedback Assessment</p>
          <h1 className="text-2xl md:text-2xl font-normal tracking-tight text-foreground mb-2">
            Evaluation
          </h1>
          <p className="text-muted-foreground font-light text-sm">
            Select an interview and submit feedback to Lever
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interview List */}
          <div className="lg:col-span-4 h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="h-full flex flex-col border border-border/60 rounded-xl bg-card/30 overflow-hidden">
              {/* Search and Actions */}
              <div className="p-4 border-b border-border/40 bg-card/20 backdrop-blur-sm space-y-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    type="text"
                    value={interviewSearch}
                    onChange={(e) => setInterviewSearch(e.target.value)}
                    placeholder="Search interviews..."
                    className="pl-10 pr-10 h-10 bg-background/50 border-border/40 rounded-lg text-sm"
                  />
                  {interviewSearch && (
                    <button
                      type="button"
                      onClick={() => setInterviewSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                
                {/* Refresh Button */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => pollForNewTranscript(false)}
                    disabled={pollingForTranscript}
                  >
                    {pollingForTranscript ? (
                      <>
                        <Spinner size={14} className="text-primary" />
                        Checking Drive...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Check for New Transcripts
                      </>
                    )}
                  </Button>
                  
                  {/* Polling status indicator */}
                  {pollingError && (
                    <div className="text-xs text-destructive px-1">
                      ⚠️ {pollingError.includes('No Drive folder') ? 'No Drive folder configured' : 'Check failed'}
                    </div>
                  )}
                </div>
              </div>

              {/* Interviews List */}
              <ScrollArea className="flex-1">
                {interviewsLoading && filteredInterviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Spinner size={32} className="text-primary" />
                  </div>
                ) : filteredInterviews.length === 0 ? (
                  <div className="p-3">
                    {pollingForTranscript ? (
                      /* Show polling card when no interviews but polling */
                      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                              <Spinner size={24} className="text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary">Searching for new transcripts...</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Checking Google Drive for your latest meeting
                            </p>
                          </div>
                        </div>
                        {/* Animated shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </div>
                    ) : pollingError ? (
                      /* Show error message with actionable steps */
                      <div className="space-y-3">
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                          <div className="flex gap-3">
                            <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                              <X className="h-5 w-5 text-destructive" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-destructive mb-1">
                                Unable to find transcripts
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pollingError}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {pollingError.includes('No Drive folder configured') ? (
                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <div className="text-sm font-medium mb-2">First-time setup required</div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                              <li>Go to <Link href="/history" className="text-primary hover:underline font-medium">History</Link> page</li>
                              <li>Click "Import from Drive" button</li>
                              <li>Select your Google Drive folder with meeting transcripts</li>
                              <li>Return here and click "Check for new transcripts"</li>
                            </ol>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <div className="text-sm font-medium mb-2">Possible reasons</div>
                            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                              <li>Transcript not yet in Drive (takes 1-2 minutes after meeting)</li>
                              <li>Meeting transcript not saved to your configured folder</li>
                              <li>Drive permissions may need to be refreshed</li>
                            </ul>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pollForNewTranscript()}
                            disabled={pollingForTranscript}
                            className="flex-1"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Try again
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => router.push('/history')}
                            className="flex-1"
                          >
                            Go to History
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 px-4">
                        <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground mb-3">
                          {interviewSearch ? 'No matching interviews' : 'No interviews available'}
                        </p>
                        {!interviewSearch && (searchParams.get('meeting') || searchParams.get('ts')) && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Transcript may take 1-2 minutes to appear after meeting ends
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pollForNewTranscript()}
                              disabled={pollingForTranscript}
                            >
                              Check for new transcripts
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {/* Polling indicator at top of list */}
                    {pollingForTranscript && (
                      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <Spinner size={20} className="text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary">Searching for new transcripts...</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Checking Google Drive for your latest meeting
                            </p>
                          </div>
                        </div>
                        {/* Animated shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </div>
                    )}
                    
                    {/* Error message at top of list */}
                    {pollingError && (searchParams.get('meeting') || searchParams.get('ts')) && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-2">
                        <div className="flex gap-2.5 items-start">
                          <X className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-destructive mb-0.5">
                              Latest transcript not found
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {pollingError.includes('No Drive folder configured') 
                                ? 'Import your Drive folder on the History page to auto-load transcripts'
                                : 'Transcript may take 1-2 minutes after meeting ends'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => pollForNewTranscript()}
                            disabled={pollingForTranscript}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {filteredInterviews.map((interview) => (
                      (() => {
                        const date = new Date(interview.meeting_date || interview.created_at)
                        const today = new Date()
                        const yesterday = new Date(today)
                        yesterday.setDate(yesterday.getDate() - 1)
                        const dateLabel =
                          date.toDateString() === today.toDateString()
                            ? 'Today'
                            : date.toDateString() === yesterday.toDateString()
                              ? 'Yesterday'
                              : date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
                                })

                        const { role, company } = formatRoleAndCompany(interview.position)
                        const isInterview = interview.meeting_type === 'Interview' || interview.meeting_title === 'Interview'
                        const isSubmitted = Boolean(interview.submitted_at || interview.candidate_id)
                        return (
                      <button
                        key={interview.id}
                        onClick={() => selectInterview(interview)}
                        className={cn(
                          "w-full text-left border rounded-xl p-4 transition-all",
                          selectedInterview?.id === interview.id
                            ? "bg-primary/10 border-primary/40 shadow-sm"
                            : "bg-card/40 border-border/40 hover:bg-card/60 hover:border-border hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-peach/30 to-peach/10 flex items-center justify-center shrink-0 border border-peach/20 shadow-sm">
                            <span className="text-sm font-semibold text-foreground tracking-tight">
                              {(interview.candidate_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                              <div className="min-w-0">
                                <h3 className={cn(
                                  "text-sm font-medium truncate",
                                  selectedInterview?.id === interview.id ? "text-primary" : "text-foreground"
                                )}>
                                  {interview.candidate_name || 'Unknown Candidate'}
                                </h3>
                                {!!role && (
                                  <p className="mt-1 text-xs text-muted-foreground truncate">
                                    {company ? `${role} • ${company}` : role}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                <time className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                  {dateLabel}
                                </time>
                                {selectedInterview?.id === interview.id && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {interview.meeting_type && (
                                <Badge variant="secondary" className="text-xs font-medium px-3 py-1 bg-peach/20 text-foreground border-0 rounded-full">
                                  {interview.meeting_type}
                                </Badge>
                              )}

                              {interview.meeting_title && interview.meeting_title !== 'Interview' && interview.meeting_title !== interview.meeting_type && (
                                <ParsedTitle 
                                  title={interview.meeting_title}
                                  badgeClassName="px-2.5 py-0.5"
                                />
                              )}

                              {isInterview && (
                                <div className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                  "border transition-all duration-300",
                                  "shadow-sm hover:shadow",
                                  isSubmitted
                                    ? "bg-success/10 border-success/30 text-success hover:bg-success/15"
                                    : "bg-warning/10 border-warning/30 text-warning hover:bg-warning/15"
                                )}>
                                  <div className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    isSubmitted ? "bg-success" : "bg-warning"
                                  )} />
                                  {isSubmitted ? 'Submitted' : 'Not Submitted'}
                                </div>
                              )}

                              {interview.interviewer && (
                                <Badge variant="outline" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium">
                                  <Avatar className="h-4 w-4 border border-border/40">
                                    <AvatarImage
                                      src={session?.user?.image || undefined}
                                      alt={session?.user?.name || 'User'}
                                    />
                                    <AvatarFallback className="text-[9px] font-semibold bg-muted/50 text-foreground/70">
                                      {viewerInitials || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {interview.interviewer}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                        )
                      })()
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Right: Transcript & Evaluation Form */}
          {!selectedInterview ? (
            <div className="lg:col-span-8 h-[calc(100vh-12rem)] min-h-[600px]">
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-border/60 rounded-xl bg-card/20">
                <FileText className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Interview Selected</h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm text-center">
                  Select an interview from the list to view the transcript and submit feedback
                </p>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transcript */}
                <div className="h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="h-full flex flex-col border border-border/60 rounded-xl bg-card/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-card/20 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-secondary/30 flex items-center justify-center">
                     <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-xs tracking-wide">TRANSCRIPT</span>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-hidden">
                <div className="h-full bg-background/30 rounded-lg border border-border/40 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                      {formatTranscript(transcript).map((line) => (
                        <div key={line.id}>
                          {line.speaker ? (
                            <>
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
                                        {line.speaker.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-sm font-semibold text-foreground">{line.speaker}</span>
                                </div>
                                {line.timestamp && (
                                  <span className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded">
                                    {line.timestamp}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm leading-relaxed font-light ml-10 text-foreground/80">
                                {line.content}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm leading-relaxed font-light text-muted-foreground/90 italic">
                              {line.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
                </div>

                {/* Evaluation Form */}
                <div className="h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="h-full flex flex-col border border-border/60 rounded-xl bg-card/30 overflow-hidden">
               <div className="px-4 py-3 border-b border-border/40 bg-card/20 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-secondary/30 flex items-center justify-center">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-xs tracking-wide">EVALUATION FORM</span>
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Selection Flow */}
                  <div className="grid gap-6">
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
                          onValueChange={(value) => {
                            if (selectedInterview?.id) manualTemplateInterviewIdRef.current = selectedInterview.id
                            // #region agent log (hypothesis E)
                            fetch('http://127.0.0.1:7244/ingest/e9fe012d-75cb-4528-8bd7-ab7d06b4d4db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'E',location:'web-app/app/feedback/page.tsx:templateSelect:onValueChange',message:'User changed template',data:{interviewId:selectedInterview?.id||null,fromTemplateId:selectedTemplate,toTemplateId:value,fromTemplateName:templates.find(t=>t.id===selectedTemplate)?.name||null,toTemplateName:templates.find(t=>t.id===value)?.name||null},timestamp:Date.now()})}).catch(()=>{});
                            // #endregion
                            setSelectedTemplate(value)
                          }}
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

                  {/* Re-analyze button */}
                  {currentTemplate && transcript && !analysisLoading && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {analysis ? 'AI analysis complete' : 'Ready to analyze'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // FIRST: Set loading to true synchronously BEFORE anything else
                          setAnalysisLoading(true)
                          
                          // THEN: Clear cache and trigger analysis in next tick
                          setTimeout(() => {
                            if (selectedInterview?.id && currentTemplate?.id) {
                              const cacheKey = buildAnalysisCacheKey(selectedInterview.id, currentTemplate.id, transcript)
                              analysisCacheRef.current.delete(cacheKey)
                            }
                            lastAutoAnalyzeKeyRef.current = null
                            analyzeTranscript(transcript, currentTemplate)
                          }, 0)
                        }}
                        className="gap-1.5 h-8 text-xs"
                        disabled={analysisLoading}
                      >
                        <MagicWandIcon className="h-3.5 w-3.5" />
                        {analysisLoading ? 'Analyzing...' : (analysis ? 'Re-analyze' : 'Analyze')}
                      </Button>
                    </div>
                  )}

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
                                    {fieldErrors[field.text] && (
                                      <p className="text-xs text-destructive">{fieldErrors[field.text]}</p>
                                    )}
                                    
                                    {/* Score field type (1-4) - render as 4-level thumbs (like Lever Portfolio Interview) */}
                                    {field.type === 'score' ? (
                                      <div className="space-y-2">
                                        <div className="flex gap-1.5">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11"
                                            style={dynamicAnswers[field.text] === '1' ? {
                                              backgroundColor: 'hsl(var(--destructive))',
                                              color: 'hsl(var(--destructive-foreground))',
                                              borderColor: 'hsl(var(--destructive))'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: '1' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                            title="1 - Poor"
                                          >
                                            <ThumbsDown className="h-4 w-4" />
                                            <ThumbsDown className="h-4 w-4 -ml-3" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11"
                                            style={dynamicAnswers[field.text] === '2' ? {
                                              backgroundColor: '#f97316',
                                              color: 'white',
                                              borderColor: '#f97316'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: '2' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                            title="2 - Fair"
                                          >
                                            <ThumbsDown className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11"
                                            style={dynamicAnswers[field.text] === '3' ? {
                                              backgroundColor: 'hsl(var(--success))',
                                              color: 'hsl(var(--success-foreground))',
                                              borderColor: 'hsl(var(--success))'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: '3' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                            title="3 - Good"
                                          >
                                            <ThumbsUp className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11"
                                            style={dynamicAnswers[field.text] === '4' ? {
                                              backgroundColor: 'hsl(var(--success))',
                                              color: 'hsl(var(--success-foreground))',
                                              borderColor: 'hsl(var(--success))'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: '4' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                            title="4 - Excellent"
                                          >
                                            <ThumbsUp className="h-4 w-4" />
                                            <ThumbsUp className="h-4 w-4 -ml-3" />
                                          </Button>
                                          {dynamicAnswers[field.text] && dynamicAnswers[field.text] !== '?' && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-11 w-11"
                                              onClick={() => {
                                                setDynamicAnswers({ ...dynamicAnswers, [field.text]: '?' })
                                              }}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                        {aiGeneratedFields[field.text] && (
                                          <Badge variant="outline" className="gap-1 rounded-full border-primary/20 bg-primary/5 text-[10px] text-primary">
                                            <MagicWandIcon className="h-3 w-3" />
                                            AI suggested
                                          </Badge>
                                        )}
                                      </div>
                                    ) : field.type === 'yes-no' ? (
                                      <div className="space-y-2">
                                        <div className="flex gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11 gap-2"
                                            style={dynamicAnswers[field.text] === 'yes' ? {
                                              backgroundColor: 'hsl(var(--success))',
                                              color: 'hsl(var(--success-foreground))',
                                              borderColor: 'hsl(var(--success))'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: 'yes' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                          >
                                            <ThumbsUp className="h-4 w-4" /> Yes
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-11 gap-2"
                                            style={dynamicAnswers[field.text] === 'no' ? {
                                              backgroundColor: 'hsl(var(--destructive))',
                                              color: 'hsl(var(--destructive-foreground))',
                                              borderColor: 'hsl(var(--destructive))'
                                            } : undefined}
                                            onClick={() => {
                                              setDynamicAnswers({ ...dynamicAnswers, [field.text]: 'no' })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                              setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                              setFieldErrors(prev => { const next = { ...prev }; delete next[field.text]; return next })
                                            }}
                                          >
                                            <ThumbsDown className="h-4 w-4" /> No
                                          </Button>
                                          {dynamicAnswers[field.text] && dynamicAnswers[field.text] !== '?' && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-11 w-11"
                                              onClick={() => {
                                                setDynamicAnswers({ ...dynamicAnswers, [field.text]: '?' })
                                              }}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                        {aiGeneratedFields[field.text] && (
                                          <Badge variant="outline" className="gap-1 rounded-full border-primary/20 bg-primary/5 text-[10px] text-primary">
                                            <MagicWandIcon className="h-3 w-3" />
                                            AI suggested
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (field.type === 'score-system' || field.type === 'dropdown' || field.text.toLowerCase().includes('rating')) ? (
                                       <Select 
                                          value={dynamicAnswers[field.text] || ''} 
                                          onValueChange={(val) => {
                                            setDynamicAnswers({ ...dynamicAnswers, [field.text]: val })
                                            setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                            setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                            const msg = validateField(field as any, val)
                                            setFieldErrors(prev => {
                                              const next = { ...prev }
                                              if ((submitAttempted || true) && msg) next[field.text] = msg
                                              else delete next[field.text]
                                              return next
                                            })
                                          }}
                                       >
                                          <SelectTrigger className={`h-11 ${fieldErrors[field.text] ? 'border-destructive focus:ring-destructive/30' : ''}`}>
                                             <SelectValue placeholder={field.type === 'score' ? 'Select score...' : field.type === 'dropdown' ? 'Select option...' : 'Select rating...'} />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="?">?</SelectItem>
                                             {(Array.isArray(field.options) ? field.options : [])
                                               .map((o: any) => (o && typeof o === 'object' ? (o.text ?? o.optionId ?? o.value) : o))
                                               .map((v: any) => (typeof v === 'string' ? v.trim() : String(v)))
                                               .filter(Boolean)
                                               .map((text: string) => (
                                                 <SelectItem key={text} value={text}>{text}</SelectItem>
                                               ))}
                                          </SelectContent>
                                       </Select>
                                    ) : (
                                      <div className={`flex flex-col rounded-lg border bg-input shadow-sm transition-all duration-200 focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring/50 resize-y overflow-hidden ${fieldErrors[field.text] ? 'border-destructive focus-within:ring-destructive/30' : 'border-input'}`}>
                                        <Textarea 
                                          value={dynamicAnswers[field.text] || ''}
                                          onChange={(e) => {
                                            setDynamicAnswers({ ...dynamicAnswers, [field.text]: e.target.value })
                                            setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                            const val = e.target.value
                                            setTouchedFields(prev => ({ ...prev, [field.text]: true }))
                                            const msg = validateField(field as any, val)
                                            setFieldErrors(prev => {
                                              const next = { ...prev }
                                              if ((submitAttempted || true) && msg) next[field.text] = msg
                                              else delete next[field.text]
                                              return next
                                            })
                                          }}
                                          rows={field.type === 'textarea' ? 4 : 3}
                                          className="min-h-[146px] w-full resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus:ring-0 focus-visible:ring-0 focus:border-0 focus-visible:ring-offset-0 active:ring-0 active:border-0"
                                          placeholder="AI will generate this..."
                                        />
                                        <div className="flex items-center justify-between px-2 pb-2 pt-2 border-t border-[#c7c7c7]">
                                          <VoiceRecorder 
                                            onTranscriptionComplete={(text) => {
                                              setDynamicAnswers(prev => {
                                                const currentVal = prev[field.text] || ''
                                                const newVal = currentVal ? `${currentVal} ${text}` : text
                                                return { ...prev, [field.text]: newVal }
                                              })
                                              setAiGeneratedFields(prev => ({ ...prev, [field.text]: false }))
                                            }} 
                                          />
                                          {aiGeneratedFields[field.text] && (
                                            <Badge variant="outline" className="gap-1 rounded-full border-primary/20 bg-primary/5 text-[10px] text-primary">
                                              <MagicWandIcon className="h-3 w-3" />
                                              AI generated
                                            </Badge>
                                          )}
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
                           <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 whitespace-pre-wrap">
                              {error}
                           </div>
                        )}
                     </div>
                  )}
               </div>
               
               <div className="p-4 border-t border-border/40 bg-card/20 flex flex-col sm:flex-row justify-between items-center gap-3 backdrop-blur-sm">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                     {selectedCandidate && selectedTemplate ? 'Ready to submit' : 'Select candidate & template'}
                  </span>
                  <Button 
                     onClick={handleSubmit} 
                     disabled={!selectedCandidate || !selectedTemplate || submitting || analysisLoading}
                     className="w-full sm:w-auto min-w-[140px] rounded-full h-10"
                  >
                     {submitting ? 'Submitting...' : 'Submit to Lever'}
                  </Button>
               </div>
                </div>
              </div>
            </div>
              </div>
          )}
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
