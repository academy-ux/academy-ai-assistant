'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronsUpDown, Check, Search, CloudDownload, FileText, Calendar, User, X, Send, ChevronRight, ChevronLeft, RefreshCw, SlidersHorizontal, Trash2, CheckSquare, Square, MinusSquare, Plus } from 'lucide-react'
import { MagicWandIcon } from '@/components/icons/magic-wand'
import { VoiceRecorder } from '@/components/voice-recorder'
import { Message, MessageContent, MessageAvatar } from '@/components/ui/message'
import { Response } from '@/components/ui/response'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { SetupGuideDialog } from '@/components/setup-guide-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ConversationsSidebar } from '@/components/conversations-sidebar'
import { toast } from "sonner"

interface Meeting {
  id: string
  candidate_name: string
  interviewer?: string
  position: string
  meeting_title: string
  meeting_type?: string
  meeting_date?: string
  summary?: string
  transcript: string
  created_at: string
  candidate_id?: string | null
  submitted_at?: string | null
  similarity?: number
}

interface Source {
  id: string
  candidateName: string
  meetingDate: string
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  timestamp: Date
}

interface UncategorizedCandidate {
  id: string
  name: string
  stage: string
}

export default function HistoryPage() {
  const { data: session } = useSession()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMeetingType, setSelectedMeetingType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('all')
  const [aiQuestion, setAiQuestion] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [activeTab, setActiveTab] = useState<'meetings' | 'ask'>('meetings')
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const router = useRouter()

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Uncategorized Candidates State
  const [uncategorizedCandidates, setUncategorizedCandidates] = useState<UncategorizedCandidate[]>([])
  const [uncategorizedLoading, setUncategorizedLoading] = useState(false)

  // Import State
  const [importOpen, setImportOpen] = useState(false)
  const [folders, setFolders] = useState<{ id: string, name: string, modifiedTime: string, owners?: { displayName: string }[], shared?: boolean }[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ name: string, status: string }[]>([])
  const [previewFiles, setPreviewFiles] = useState<{ id: string, name: string, modifiedTime: string, alreadyImported?: boolean }[]>([])
  const [previewStats, setPreviewStats] = useState<{ total: number, newCount: number, importedCount: number }>({ total: 0, newCount: 0, importedCount: 0 })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, fileName: '' })
  const [importStartTime, setImportStartTime] = useState<number>(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('')
  const [importComplete, setImportComplete] = useState(false)
  const importReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  // Folder search state
  const [folderSearch, setFolderSearch] = useState('')
  const [folderOpen, setFolderOpen] = useState(false)

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState({
    driveFolderId: null as string | null,
    autoPollEnabled: false,
    pollIntervalMinutes: 15,
    lastPollTime: null as string | null,
    folderName: null as string | null,
    lastPollFileCount: 0,
  })
  const [settingsLoading, setSettingsLoading] = useState(false)

  const viewerLabel = session?.user?.name || session?.user?.email || ''
  const viewerInitials = (viewerLabel || 'U')
    .trim()
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [polling, setPolling] = useState<'quick' | 'full' | null>(null)
  const [pollResult, setPollResult] = useState<{ imported: number, skipped: number, errors: number } | null>(null)
  const [settingsFolderOpen, setSettingsFolderOpen] = useState(false)
  const [settingsSelectedFolder, setSettingsSelectedFolder] = useState('')
  const hasAutoPolled = useRef(false)

  // Diagnostic state
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<any>(null)

  // Regenerate summaries state
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState({ current: 0, total: 0 })
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [showRecategorizeConfirm, setShowRecategorizeConfirm] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null)

  // Multi-select state
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)

  // Conversation scroll ref
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const [folderSearchLoading, setFolderSearchLoading] = useState(false)

  // Filters state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateRange, setDateRange] = useState<string>('all')
  const [selectedPosition, setSelectedPosition] = useState<string>('all')
  const [selectedInterviewer, setSelectedInterviewer] = useState<string>('all')
  const [selectedCandidate, setSelectedCandidate] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date-desc')

  const ITEMS_PER_PAGE = 20

  function formatRoleAndCompany(position?: string) {
    if (!position) return { role: '', company: '' }
    const raw = position.trim()

    // If already formatted with a bullet, keep as-is.
    if (raw.includes('•')) {
      const [role, ...rest] = raw.split('•')
      return { role: role.trim(), company: rest.join('•').trim() }
    }

    // Try common separators
    const separators = [' - ', ' — ', ' – ', ' @ ', ' | ']
    const sep = separators.find(s => raw.includes(s))
    if (!sep) return { role: raw, company: '' }

    const parts = raw.split(sep).map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) return { role: raw, company: '' }

    const looksLikeRole = (s: string) =>
      /(designer|design|engineer|product|manager|lead|founding|director|vp|marketing|sales|research|ops|data|frontend|backend|full[- ]?stack)/i.test(s)

    // Heuristic: whichever side looks more like a role becomes role; the other becomes company.
    const [a, b] = [parts[0], parts.slice(1).join(sep).trim()]
    const aIsRole = looksLikeRole(a)
    const bIsRole = looksLikeRole(b)

    if (aIsRole && !bIsRole) return { role: a, company: b }
    if (!aIsRole && bIsRole) return { role: b, company: a }

    // Default: assume first is role, second is company
    return { role: a, company: b }
  }

  const fetchMeetings = useCallback(async (pageNum = 0, append = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setMeetings([])
        setPage(0)
        setHasMore(true)
      }

      const offset = pageNum * ITEMS_PER_PAGE
      const res = await fetch(`/api/interviews?limit=${ITEMS_PER_PAGE}&offset=${offset}&view=${viewMode}`)
      const data = await res.json()

      const newMeetings = data.interviews || data || []

      if (append) {
        setMeetings(prev => [...prev, ...newMeetings])
      } else {
        setMeetings(newMeetings)
      }

      // Set total count from API response
      if (data.count !== undefined) {
        setTotalCount(data.count)
      }

      // Check if there are more items to load
      setHasMore(newMeetings.length === ITEMS_PER_PAGE)

    } catch (error) {
      console.error('Error loading meetings', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [viewMode])

  function loadMoreMeetings() {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchMeetings(nextPage, true)
    }
  }

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data) {
        setSettings(data)
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  // Debounce folder search
  useEffect(() => {
    if (!importOpen && !settingsOpen) return

    const timer = setTimeout(() => {
      fetchFolders(folderSearch)
    }, 300)

    return () => clearTimeout(timer)
  }, [folderSearch, importOpen, settingsOpen])

  useEffect(() => {
    if (selectedFolder) {
      fetchPreviewFiles(selectedFolder)
    } else {
      setPreviewFiles([])
    }
  }, [selectedFolder])

  useEffect(() => {
    if (session) {
      fetchMeetings()
      loadSettings()

      // Auto-poll for new transcripts on page load (but only once per session)
      if (!hasAutoPolled.current) {
        hasAutoPolled.current = true
        // Silent poll in the background (fast mode)
        handleManualPoll(true)
      }
    }
  }, [session, fetchMeetings, loadSettings])

  // Refresh meetings when page becomes visible (user returns from another tab/page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session) {
        fetchMeetings()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also refresh on window focus
    const handleFocus = () => {
      if (session) {
        fetchMeetings()
      }
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session])

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, asking])

  // Handle body overflow for Ask AI tab
  useEffect(() => {
    if (activeTab === 'ask') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeTab])

  // Live search with debouncing
  useEffect(() => {
    // If search query is empty, fetch all meetings
    if (!searchQuery.trim()) {
      const timer = setTimeout(() => {
        fetchMeetings()
      }, 300)
      return () => clearTimeout(timer)
    }

    // Debounce search API calls
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/interviews/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, searchType: 'keyword' })
        })
        const data = await res.json()
        if (data.results) {
          // Apply viewMode filter client-side
          let filteredResults = data.results
          if (viewMode === 'mine' && session?.user?.email) {
            // Show only user's own meetings
            const userEmail = session.user.email
            filteredResults = data.results.filter((m: any) =>
              m.owner_email === userEmail || !m.owner_email
            )
          }
          setMeetings(filteredResults)
        }
      } catch (error) {
        console.error('Search failed', error)
      } finally {
        setLoading(false)
      }
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
  }, [searchQuery, viewMode, session?.user?.email])

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreMeetings()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current)
      }
    }
  }, [hasMore, loading, loadingMore, page])

  async function fetchFolders(query: string = '') {
    setFolderSearchLoading(true)
    if (query) setFoldersError('')

    try {
      const res = await fetch(`/api/drive/folders?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.error) {
        setFoldersError(data.error)
      } else if (data.folders) {
        setFolders(data.folders)

        if (!selectedFolder && !query) {
          const meetFolder = data.folders.find((f: any) => f.name === 'Meet Recordings')
          if (meetFolder) {
            setSelectedFolder(meetFolder.id)
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch folders', error)
      setFoldersError(error.message || 'Failed to load folders')
    } finally {
      setFoldersLoading(false)
      setFolderSearchLoading(false)
    }
  }

  async function fetchPreviewFiles(folderId: string) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`)
      const data = await res.json()
      if (data.files) {
        setPreviewFiles(data.files)
        setPreviewStats({
          total: data.total || data.files.length,
          newCount: data.newCount || 0,
          importedCount: data.importedCount || 0
        })
      }
    } catch (e) {
      console.error('Failed to load preview files', e)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function saveSettings(updates: Partial<typeof settings>) {
    setSettingsSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        setSettings({ ...settings, ...updates })
        toast.success('Settings saved')
      }
    } catch (e) {
      console.error('Failed to save settings', e)
      toast.error('Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleSaveFolder() {
    if (!settingsSelectedFolder) return

    const selectedFolderData = folders.find(f => f.id === settingsSelectedFolder)
    if (!selectedFolderData) return

    await saveSettings({
      driveFolderId: settingsSelectedFolder,
      folderName: selectedFolderData.name
    })

    setSettingsSelectedFolder('')
  }

  async function runDiagnostic() {
    setDiagnosing(true)
    setDiagnosticResult(null)
    try {
      const res = await fetch('/api/debug-sync')
      const data = await res.json()
      if (res.ok) {
        setDiagnosticResult(data)

        // If there are files in Drive not in DB, offer to import them
        if (data.inDriveNotInDb && data.inDriveNotInDb.length > 0) {
          toast.info(`Found ${data.inDriveNotInDb.length} files in Drive not imported yet`)
        } else if (data.summary.matched === data.summary.totalInDrive) {
          toast.success('✓ All Drive files are synced!')
        }
      } else {
        toast.error(data.error || 'Failed to run diagnostic')
      }
    } catch (error) {
      console.error('Diagnostic error:', error)
      toast.error('Failed to run diagnostic')
    } finally {
      setDiagnosing(false)
    }
  }

  async function runBackfillDriveIds() {
    setBackfilling(true)
    setBackfillResult(null)
    try {
      const res = await fetch('/api/backfill-drive-ids', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setBackfillResult(data)
        toast.success(`✓ Updated ${data.updated} records with Drive IDs!`)
        // Refresh diagnostic after backfill
        setTimeout(() => runDiagnostic(), 1000)
      } else {
        toast.error(data.error || 'Failed to backfill Drive IDs')
      }
    } catch (error) {
      console.error('Backfill error:', error)
      toast.error('Failed to backfill Drive IDs')
    } finally {
      setBackfilling(false)
    }
  }

  async function handleManualPoll(silent: boolean = false, fullSync: boolean = false) {
    if (!silent) {
      setPolling(fullSync ? 'full' : 'quick')
      setPollResult(null)
    }
    try {
      const res = await fetch('/api/poll-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fastMode: !fullSync,
          includeSubfolders: true
        })
      })
      const data = await res.json()
      if (res.ok) {
        if (!silent) {
          setPollResult({
            imported: data.imported,
            skipped: data.skipped,
            errors: data.errors
          })

          if (data.imported > 0) {
            toast.success(`Imported ${data.imported} new meetings`)
          } else {
            toast.info('No new meetings found')
          }
        }

        // Reload settings to get updated lastPollTime
        await loadSettings()
        // Refresh meetings list if new files were imported
        if (data.imported > 0) {
          await fetchMeetings(0, false)
        }
      } else if (!silent) {
        toast.error(data.error || 'Failed to poll Drive folder')
      }
    } catch (e) {
      console.error('Failed to poll Drive', e)
      if (!silent) {
        toast.error('Failed to poll Drive folder')
      }
    } finally {
      if (!silent) {
        setPolling(null)
      }
    }
  }

  async function handleImport() {
    if (!selectedFolder) return
    setImporting(true)
    setImportResults([])
    setImportProgress({ current: 0, total: previewFiles.length || 0, fileName: '' })
    setImportStartTime(Date.now())
    setEstimatedTimeRemaining('Calculating...')
    setImportComplete(false)

    try {
      const res = await fetch('/api/drive/import/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: selectedFolder })
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to start import')
      }

      const reader = res.body.getReader()
      importReaderRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      // Throttling state updates to prevent UI freezing with 1000+ files
      let lastUpdate = Date.now()
      let pendingResults: { name: string, status: string }[] = []
      let pendingProgress: { current: number, total: number, fileName: string } | null = null

      // Function to flush pending updates to state
      const flushUpdates = () => {
        if (pendingResults.length > 0) {
          const currentBatch = [...pendingResults]
          setImportResults(prev => [...prev, ...currentBatch])
          pendingResults = []
        }
        if (pendingProgress) {
          setImportProgress(pendingProgress)

          // Calculate ETA
          const elapsed = Date.now() - importStartTime
          const progress = pendingProgress.current / pendingProgress.total

          if (progress > 0 && pendingProgress.current > 0) {
            const totalEstimated = elapsed / progress
            const remaining = totalEstimated - elapsed

            if (remaining > 0) {
              const minutes = Math.floor(remaining / 60000)
              const seconds = Math.floor((remaining % 60000) / 1000)

              if (minutes > 0) {
                setEstimatedTimeRemaining(`~${minutes}m ${seconds}s remaining`)
              } else {
                setEstimatedTimeRemaining(`~${seconds}s remaining`)
              }
            } else {
              setEstimatedTimeRemaining('Almost done...')
            }
          }

          pendingProgress = null
        }
        lastUpdate = Date.now()
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'total') {
              setImportProgress({ current: 0, total: data.total, fileName: '' })
            } else if (data.type === 'progress') {
              pendingProgress = { current: data.current, total: data.total, fileName: data.fileName || '' }
            } else if (data.type === 'result') {
              pendingResults.push({ name: data.name, status: data.status })
            } else if (data.type === 'complete') {
              flushUpdates() // Ensure final updates are shown
              setImportComplete(true)
              fetchMeetings()

              // Save the imported folder to settings for future sessions
              if (selectedFolder) {
                const selectedFolderData = folders.find(f => f.id === selectedFolder)
                if (selectedFolderData) {
                  saveSettings({
                    driveFolderId: selectedFolder,
                    folderName: selectedFolderData.name
                  })
                }
              }
            } else if (data.type === 'error') {
              console.error('Import error:', data.message)
            }
          }
        }

        // Only update React state every 100ms to keep UI responsive
        if (Date.now() - lastUpdate > 100) {
          flushUpdates()
        }
      }

      // Final flush after loop (in case it finished without 'complete' event or just to be safe)
      flushUpdates()

    } catch (error) {
      console.error('Import failed', error)
      toast.error('Import failed. Please try again.')
    } finally {
      setImporting(false)
      importReaderRef.current = null
    }
  }


  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      fetchMeetings()
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/interviews/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, searchType: 'keyword' })
      })
      const data = await res.json()
      if (data.results) {
        setMeetings(data.results)
      }
    } catch (error) {
      console.error('Search failed', error)
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveConversation(updatedMessages: ConversationMessage[]) {
    try {
      // Generate title from first user message
      const firstUserMessage = updatedMessages.find(m => m.role === 'user')
      const title = firstUserMessage ? firstUserMessage.content.slice(0, 100) : 'Conversation'

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentConversationId,
          interview_id: null, // Global conversation
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
    if (!aiQuestion.trim()) return

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
      setAiQuestion('') // Clear input immediately

      // Include conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const res = await fetch('/api/interviews/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          history: conversationHistory
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
      // Add error message
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

  async function handleRegenerateSummaries() {
    try {
      setRegenerating(true)
      setRegenerateProgress({ current: 0, total: 0 })

      const res = await fetch('/api/interviews/reparse-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()

      if (data.updated) {
        setRegenerateProgress({ current: data.updated, total: data.total })
        // Refresh meetings
        await fetchMeetings()
        toast.success(`Regenerated summaries for ${data.updated} meetings`)
      }
    } catch (error) {
      console.error('Regenerate failed', error)
      toast.error('Failed to regenerate summaries')
    } finally {
      setRegenerating(false)
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
    setActiveTab('ask')
  }

  function handleNewConversation() {
    setMessages([])
    setAiQuestion('')
    setCurrentConversationId(null)
    setActiveTab('ask')
  }

  async function handleDeleteMeeting(meeting: Meeting) {
    setMeetingToDelete(meeting)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!meetingToDelete) return

    setDeletingId(meetingToDelete.id)
    setShowDeleteConfirm(false)

    try {
      const res = await fetch(`/api/interviews/${meetingToDelete.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        // Remove from local state
        setMeetings(prev => prev.filter(m => m.id !== meetingToDelete.id))
        setTotalCount(prev => Math.max(0, prev - 1))
        toast.success('Meeting deleted successfully')
      } else {
        throw new Error('Failed to delete meeting')
      }
    } catch (error) {
      console.error('Delete failed', error)
      toast.error('Failed to delete meeting. Please try again.')
    } finally {
      setDeletingId(null)
      setMeetingToDelete(null)
    }
  }

  // Get unique values for filters
  const positions = Array.from(new Set(meetings.map(m => m.position).filter((p): p is string => Boolean(p)))).sort()
  const interviewers = Array.from(new Set(meetings.map(m => m.interviewer).filter((i): i is string => Boolean(i)))).sort()
  const candidates = Array.from(new Set(meetings.map(m => m.candidate_name).filter((c): c is string => Boolean(c)))).sort()

  // Apply filters to meetings
  const filteredMeetings = meetings
    .filter(meeting => {
      // Meeting type filter
      if (selectedMeetingType !== 'all' && meeting.meeting_type !== selectedMeetingType) return false

      // Date range filter
      if (dateRange !== 'all') {
        const meetingDate = new Date(meeting.meeting_date || meeting.created_at)
        const now = new Date()

        if (dateRange === '7days') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (meetingDate < weekAgo) return false
        } else if (dateRange === '30days') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (meetingDate < monthAgo) return false
        } else if (dateRange === '3months') {
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          if (meetingDate < threeMonthsAgo) return false
        }
      }

      // Position filter
      if (selectedPosition !== 'all' && meeting.position !== selectedPosition) return false

      // Interviewer filter
      if (selectedInterviewer !== 'all' && meeting.interviewer !== selectedInterviewer) return false

      // Candidate filter
      if (selectedCandidate !== 'all' && meeting.candidate_name !== selectedCandidate) return false

      return true
    })
    .sort((a, b) => {
      // Sort
      if (sortBy === 'date-desc') {
        return new Date(b.meeting_date || b.created_at).getTime() - new Date(a.meeting_date || a.created_at).getTime()
      } else if (sortBy === 'date-asc') {
        return new Date(a.meeting_date || a.created_at).getTime() - new Date(b.meeting_date || b.created_at).getTime()
      } else if (sortBy === 'name-asc') {
        return (a.candidate_name || '').localeCompare(b.candidate_name || '')
      } else if (sortBy === 'name-desc') {
        return (b.candidate_name || '').localeCompare(a.candidate_name || '')
      }
      return 0
    })

  // Check if any filters are active
  const hasActiveFilters = dateRange !== 'all' || selectedPosition !== 'all' || selectedInterviewer !== 'all' || selectedCandidate !== 'all' || sortBy !== 'date-desc'

  // Clear all filters
  function clearFilters() {
    setDateRange('all')
    setSelectedPosition('all')
    setSelectedInterviewer('all')
    setSelectedCandidate('all')
    setSortBy('date-desc')
  }

  // Multi-select handlers
  function toggleMeetingSelection(meetingId: string) {
    setSelectedMeetings(prev => {
      const next = new Set(prev)
      if (next.has(meetingId)) {
        next.delete(meetingId)
      } else {
        next.add(meetingId)
      }
      return next
    })
  }

  function selectAllMeetings() {
    setSelectedMeetings(new Set(filteredMeetings.map(m => m.id)))
  }

  function deselectAllMeetings() {
    setSelectedMeetings(new Set())
  }

  async function handleBulkDelete() {
    if (selectedMeetings.size === 0) return

    setBulkDeleting(true)
    const idsToDelete = Array.from(selectedMeetings)
    let successCount = 0
    let failCount = 0

    for (const id of idsToDelete) {
      try {
        const res = await fetch(`/api/interviews/${id}`, {
          method: 'DELETE'
        })
        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`Failed to delete meeting ${id}`, error)
        failCount++
      }
    }

    // Update local state
    setMeetings(prev => prev.filter(m => !selectedMeetings.has(m.id)))
    setTotalCount(prev => Math.max(0, prev - successCount))
    setSelectedMeetings(new Set())
    setShowBulkDeleteConfirm(false)
    setBulkDeleting(false)

    if (successCount > 0) {
      toast.success(`Deleted ${successCount} meetings successfully`)
    }

    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} meetings`)
    }
  }


  // Check selection state for select-all toggle
  const allFilteredSelected = filteredMeetings.length > 0 && filteredMeetings.every(m => selectedMeetings.has(m.id))
  const someFilteredSelected = filteredMeetings.some(m => selectedMeetings.has(m.id))

  return (<TooltipProvider>
    <div className="min-h-screen bg-background">
      {/* Filters Sidebar */}
      <div
        className={cn(
          "fixed inset-0 bg-background/60 backdrop-blur-sm z-50 transition-opacity duration-300",
          filtersOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setFiltersOpen(false)}
      >
        <div
          className={cn(
            "fixed right-0 top-0 h-full w-[85vw] sm:w-[400px] bg-card/60 backdrop-blur-md border-l border-border/40 shadow-xl transition-transform duration-300 ease-in-out",
            filtersOpen ? "translate-x-0" : "translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/40">
              <div>
                <h2 className="text-2xl font-normal text-foreground">Filters</h2>
                <p className="text-sm text-muted-foreground mt-1 font-light">Refine your meeting search</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersOpen(false)}
                className="h-8 w-8 p-0 hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Filters Content */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {/* Date Range */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Date Range
                  </label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="3months">Last 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                {/* Position */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Position
                  </label>
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      {positions.map(position => (
                        <SelectItem key={position} value={position}>
                          {position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                {/* Interviewer */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Interviewer
                  </label>
                  <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Interviewers</SelectItem>
                      {interviewers.map(interviewer => (
                        <SelectItem key={interviewer} value={interviewer}>
                          {interviewer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                {/* Candidate */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Participant
                  </label>
                  <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Participants</SelectItem>
                      {candidates.map(candidate => (
                        <SelectItem key={candidate} value={candidate}>
                          {candidate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                {/* Sort */}
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full h-11 bg-background/50 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                      <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                      <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-6 border-t border-border/40 space-y-3 bg-card/20">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="w-full h-11 border-border/60 hover:bg-muted/50"
                  onClick={clearFilters}
                >
                  Clear All Filters
                </Button>
              )}
              <Button
                className="w-full h-11 rounded-full"
                onClick={() => setFiltersOpen(false)}
              >
                Apply Filters ({filteredMeetings.length})
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 pt-16">
          {/* Sticky Header */}
          <div className={cn("sticky top-16 z-20 bg-background pt-6 pb-10 mb-0")}>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30 shadow-sm ring-1 ring-foreground/5">
                  <FileText className="h-4 w-4 text-foreground/80" />
                </div>

                <div className="flex flex-col gap-1.5 min-w-0">
                  <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight truncate">
                    History
                  </h1>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium px-2.5 py-1 border-border/60 bg-peach/20 text-foreground rounded-full"
                    >
                      {totalCount} Meetings
                    </Badge>

                    {viewMode === 'mine' && (
                      <Badge variant="outline" className="text-xs px-2.5 py-1 border-border/60 rounded-full">
                        My Meetings
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Navigation */}
              <div className="flex items-center gap-2 p-1 bg-card/40 backdrop-blur border border-border/40 rounded-full w-fit shadow-sm flex-shrink-0">
                <button
                  onClick={() => setActiveTab('meetings')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                    activeTab === 'meetings'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Meetings
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

              {/* Right Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* View Mode Toggle (only show on meetings tab) */}
                {activeTab === 'meetings' && (
                  <div className="flex items-center gap-1 bg-card/40 backdrop-blur border border-border/40 rounded-full p-1 mr-2">
                    <button
                      onClick={() => setViewMode('mine')}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                        viewMode === 'mine'
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Mine
                    </button>
                    <button
                      onClick={() => setViewMode('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                        viewMode === 'all'
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All
                    </button>
                  </div>
                )}

                {/* Import Button */}
                {activeTab !== 'ask' && (
                  <div className="flex gap-2 items-center">
                    {/* ... dialogs ... */}
                  </div>
                )}

                {/* Conversation History Sidebar - only show on ask tab */}
                {activeTab === 'ask' && (
                  <ConversationsSidebar
                    interviewId={null}
                    currentConversationId={currentConversationId}
                    onSelectConversation={(conversation) => {
                      const loadedMessages = conversation.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        sources: m.sources || [],
                        timestamp: new Date(m.timestamp)
                      }))
                      setMessages(loadedMessages)
                      setCurrentConversationId(conversation.id)
                    }}
                    onNewConversation={() => {
                      setMessages([])
                      setAiQuestion('')
                      setCurrentConversationId(null)
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          {/* Background Import Indicator */}
          {importing && !importOpen && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-3 px-4 py-2 rounded-full border border-border/60 bg-card/40 hover:bg-card/60 transition-all group"
            >
              <div className="relative flex items-center justify-center">
                <div className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin-medium" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium text-foreground">Importing in background</span>
                <span className="text-[10px] text-muted-foreground">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}

          <SetupGuideDialog />
          <Dialog open={importOpen} onOpenChange={(open) => {
            // Allow closing dialog even while importing
            setImportOpen(open)
            // Reset complete state when opening
            if (open && importComplete) {
              setImportComplete(false)
              setImportResults([])
            }
            // Pre-populate folder from saved settings when opening
            if (open && !selectedFolder && settings.driveFolderId) {
              setSelectedFolder(settings.driveFolderId)
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="default" className="gap-2">
                <CloudDownload className="h-4 w-4" />
                Import from Drive
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Import Meeting Transcripts</DialogTitle>
                <DialogDescription>
                  Select a Google Drive folder containing your transcripts. We'll analyze and index them automatically.
                </DialogDescription>
              </DialogHeader>

              {!importing && importResults.length === 0 && (
                <div className="py-4 space-y-4">
                  {foldersLoading && !folderSearchLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner className="text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
                    </div>
                  ) : foldersError ? (
                    <div className="text-sm text-destructive py-4 px-3 bg-destructive/10 rounded-lg">
                      {foldersError}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-sm font-medium leading-none">
                        Select Folder
                      </label>
                      <Popover open={folderOpen} onOpenChange={setFolderOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={folderOpen}
                            className="w-full justify-between h-11"
                          >
                            {selectedFolder
                              ? folders.find((folder) => folder.id === selectedFolder)?.name
                              : "Select folder..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[440px] p-0">
                          <div className="p-3 border-b border-border">
                            <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-lg">
                              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                              <Input
                                placeholder="Search Drive folders..."
                                value={folderSearch}
                                onChange={(e) => setFolderSearch(e.target.value)}
                                className="h-9 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm shadow-none"
                              />
                              {folderSearchLoading && <Spinner size={16} />}
                            </div>
                          </div>
                          <div className="h-[300px] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
                            {folders.length === 0 ? (
                              <div className="p-8 text-sm text-muted-foreground text-center">
                                No folders found.
                              </div>
                            ) : (
                              <div className="p-2">
                                {folders.map((folder) => (
                                  <div
                                    key={folder.id}
                                    className={cn(
                                      "flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors",
                                      "hover:bg-accent",
                                      selectedFolder === folder.id && "bg-accent"
                                    )}
                                    onClick={() => {
                                      setSelectedFolder(folder.id)
                                      setFolderOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mt-0.5 h-4 w-4 text-primary shrink-0",
                                        selectedFolder === folder.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{folder.name}</span>
                                        {folder.shared && (
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">Shared</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {folder.owners?.[0]?.displayName && (
                                          <span>{folder.owners[0].displayName}</span>
                                        )}
                                        {folder.modifiedTime && (
                                          <span>{new Date(folder.modifiedTime).toLocaleDateString()}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        We recommend selecting your <strong>"Meet Recordings"</strong> folder.
                      </p>
                    </div>
                  )}

                  {/* File Preview */}
                  {selectedFolder && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {previewStats.total > 0 ? `${previewStats.total} files` : 'Files'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {!previewLoading && previewStats.total > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-primary font-medium">{previewStats.newCount} new</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{previewStats.importedCount} imported</span>
                            </div>
                          )}
                          {previewLoading && <Spinner size={14} />}
                        </div>
                      </div>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
                        {previewLoading && previewFiles.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-6">Loading files...</div>
                        ) : previewFiles.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-6">No Google Docs found in this folder.</div>
                        ) : (
                          /* Sort: new files first, then imported */
                          [...previewFiles]
                            .sort((a, b) => (a.alreadyImported === b.alreadyImported ? 0 : a.alreadyImported ? 1 : -1))
                            .map((file) => (
                              <div
                                key={file.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors",
                                  file.alreadyImported
                                    ? "bg-muted/30 border-border/30 opacity-60"
                                    : "bg-card border-border/50 hover:border-border"
                                )}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {file.alreadyImported && (
                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                  )}
                                  <span className={cn(
                                    "text-sm leading-relaxed break-words",
                                    file.alreadyImported && "text-muted-foreground"
                                  )}>
                                    {file.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {file.alreadyImported && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Imported</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    }) : ''}
                                  </span>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importing && (
                <div className="py-8 flex flex-col items-center justify-center gap-6">
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Importing transcripts...</span>
                      <span className="font-medium text-foreground">
                        {importProgress.current} / {importProgress.total}
                      </span>
                    </div>
                    <Progress
                      value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
                      className="h-2.5"
                    />
                    <div className="space-y-1">
                      {importProgress.fileName && (
                        <p className="text-xs text-muted-foreground truncate">
                          Processing: <span className="text-foreground">{importProgress.fileName}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Generating AI embeddings for each transcript
                        </p>
                        {estimatedTimeRemaining && importProgress.current > 0 && (
                          <p className="text-xs font-medium text-primary">
                            {estimatedTimeRemaining}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(importResults.length > 0 || importComplete) && (
                <div className="space-y-4">
                  {importComplete && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-peach/10 border border-peach/20">
                      <div className="h-5 w-5 rounded-full bg-peach flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-background" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Import completed successfully!</p>
                        <p className="text-xs text-muted-foreground">
                          Processed {importProgress.current} files
                        </p>
                      </div>
                    </div>
                  )}

                  {importResults.length > 0 && (
                    <ScrollArea className="h-[200px] w-full rounded-lg border p-4">
                      <div className="space-y-2">
                        {importResults.map((res: any, i) => (
                          <div key={i} className="flex justify-between items-center text-sm py-2">
                            <div className="truncate max-w-[280px]">
                              <span>{res.name}</span>
                              {res.reason && res.status === 'error' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({res.reason}{res.details ? `: ${res.details}` : ''})
                                </span>
                              )}
                            </div>
                            <Badge variant={res.status === 'imported' ? 'success' : res.status === 'error' ? 'destructive' : 'secondary'}>
                              {res.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2">
                {!importing && importResults.length === 0 && !importComplete && (
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFolder || previewStats.newCount === 0}
                    className="w-full sm:w-auto"
                  >
                    {previewStats.newCount > 0
                      ? `Import ${previewStats.newCount} New File${previewStats.newCount !== 1 ? 's' : ''}`
                      : previewStats.total > 0
                        ? 'All Files Already Imported'
                        : 'Start Import'
                    }
                  </Button>
                )}
                {importing && (
                  <Button
                    variant="outline"
                    onClick={() => setImportOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Run in Background
                  </Button>
                )}
                {(importResults.length > 0 || importComplete) && !importing && (
                  <Button onClick={() => {
                    setImportOpen(false)
                    setImportResults([])
                    setImportComplete(false)
                  }} className="w-full sm:w-auto">Done</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onOpenChange={(open) => {
            setSettingsOpen(open)
            // Pre-populate folder from saved settings when opening
            if (open && !settingsSelectedFolder && settings.driveFolderId) {
              setSettingsSelectedFolder(settings.driveFolderId)
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Auto-Polling Settings</DialogTitle>
                <DialogDescription>
                  Configure automatic import of new transcripts from Google Drive.
                </DialogDescription>
              </DialogHeader>

              {settingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="text-primary" />
                </div>
              ) : (
                <div className="space-y-6 py-4 overflow-y-auto flex-1">
                  {/* Drive Sync Diagnostic - PRIORITY SECTION */}
                  {settings.driveFolderId && (
                    <div className="space-y-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-primary" />
                        <Label className="text-base">Drive Sync Diagnostic</Label>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          className="flex-1 gap-2"
                          onClick={runBackfillDriveIds}
                          disabled={backfilling || diagnosing}
                        >
                          {backfilling ? (
                            <>
                              <Spinner size={16} className="text-primary-foreground" />
                              Linking...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              1. Link Drive IDs
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={runDiagnostic}
                          disabled={diagnosing || backfilling}
                        >
                          {diagnosing ? (
                            <>
                              <Spinner size={16} className="text-primary" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              2. Check Sync
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Run <strong>Link Drive IDs</strong> first to connect existing records, then <strong>Check Sync</strong> to verify
                      </p>

                      {backfillResult && (
                        <div className="p-3 bg-blue-500/10 rounded-lg text-sm space-y-1 border border-blue-500/20">
                          <p className="font-medium text-blue-600 dark:text-blue-400">Backfill Complete:</p>
                          <p className="text-muted-foreground">
                            ✓ Updated {backfillResult.updated} records with Drive IDs
                          </p>
                          {backfillResult.unmatched > 0 && (
                            <p className="text-muted-foreground text-xs">
                              {backfillResult.unmatched} records could not be matched
                            </p>
                          )}
                        </div>
                      )}

                      {diagnosticResult && (
                        <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-3 max-h-[300px] overflow-y-auto">
                          <div className="space-y-2">
                            <p className="font-medium">Sync Status:</p>
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <div>In Drive: {diagnosticResult.summary.totalInDrive}</div>
                              <div>In Database: {diagnosticResult.summary.totalInDatabase}</div>
                              <div className="text-green-600 dark:text-green-400">✓ Synced: {diagnosticResult.summary.matched}</div>
                              {diagnosticResult.summary.inDriveNotInDb > 0 && (
                                <div className="text-orange-600 dark:text-orange-400">⚠ Not imported: {diagnosticResult.summary.inDriveNotInDb}</div>
                              )}
                            </div>
                          </div>

                          {diagnosticResult.inDriveNotInDb && diagnosticResult.inDriveNotInDb.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2 text-orange-600 dark:text-orange-400 border-orange-500/30"
                              onClick={() => {
                                // Set the correct folder before opening import dialog
                                if (settings.driveFolderId) {
                                  setSelectedFolder(settings.driveFolderId)
                                }
                                setSettingsOpen(false)
                                setImportOpen(true)
                              }}
                            >
                              <CloudDownload className="h-3 w-3" />
                              Import {diagnosticResult.inDriveNotInDb.length} Missing Files
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Folder Info */}
                  {settings.driveFolderId ? (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Configured Folder:</span>
                      </div>
                      <p className="text-sm text-foreground ml-6">
                        {settings.folderName || 'Drive folder configured'}
                      </p>
                      {settings.lastPollTime && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Last checked: {new Date(settings.lastPollTime).toLocaleString()}
                          {settings.lastPollFileCount > 0 && ` (${settings.lastPollFileCount} files found)`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-3">
                          No Drive folder configured yet. Select a folder to enable auto-polling.
                        </p>
                      </div>

                      {foldersLoading && !folderSearchLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner className="text-primary" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
                        </div>
                      ) : foldersError ? (
                        <div className="text-sm text-destructive py-4 px-3 bg-destructive/10 rounded-lg">
                          {foldersError}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="text-sm font-medium leading-none">
                            Select Drive Folder
                          </label>
                          <Popover open={settingsFolderOpen} onOpenChange={setSettingsFolderOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={settingsFolderOpen}
                                className="w-full justify-between h-11"
                              >
                                {settingsSelectedFolder
                                  ? folders.find((folder) => folder.id === settingsSelectedFolder)?.name
                                  : "Select folder..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[472px] p-0">
                              <div className="p-3 border-b border-border">
                                <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-lg">
                                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <Input
                                    placeholder="Search Drive folders..."
                                    value={folderSearch}
                                    onChange={(e) => setFolderSearch(e.target.value)}
                                    className="h-9 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm shadow-none"
                                  />
                                  {folderSearchLoading && <Spinner size={16} />}
                                </div>
                              </div>
                              <div className="h-[300px] overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>
                                {folders.length === 0 ? (
                                  <div className="p-8 text-sm text-muted-foreground text-center">
                                    No folders found.
                                  </div>
                                ) : (
                                  <div className="p-2">
                                    {folders.map((folder) => (
                                      <div
                                        key={folder.id}
                                        className={cn(
                                          "flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors",
                                          "hover:bg-accent",
                                          settingsSelectedFolder === folder.id && "bg-accent"
                                        )}
                                        onClick={() => {
                                          setSettingsSelectedFolder(folder.id)
                                          setSettingsFolderOpen(false)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mt-0.5 h-4 w-4 text-primary shrink-0",
                                            settingsSelectedFolder === folder.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{folder.name}</span>
                                            {folder.shared && (
                                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">Shared</Badge>
                                            )}
                                          </div>
                                          {folder.owners && folder.owners.length > 0 && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {folder.owners[0].displayName}
                                            </p>
                                          )}
                                          <p className="text-xs text-muted-foreground">
                                            Modified {new Date(folder.modifiedTime).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {settingsSelectedFolder && (
                            <Button
                              onClick={handleSaveFolder}
                              disabled={settingsSaving}
                              className="w-full"
                            >
                              {settingsSaving ? (
                                <>
                                  <Spinner size={16} className="mr-2" />
                                  Saving...
                                </>
                              ) : (
                                'Save Folder'
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {settings.driveFolderId && (
                    <>
                      {/* Auto-Poll Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="auto-poll" className="text-base">
                            Enable Auto-Polling
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically check for new transcripts
                          </p>
                        </div>
                        <Switch
                          id="auto-poll"
                          checked={settings.autoPollEnabled}
                          onCheckedChange={(checked) => {
                            saveSettings({ autoPollEnabled: checked })
                          }}
                          disabled={settingsSaving}
                        />
                      </div>

                      {settings.autoPollEnabled && (
                        <>
                          <Separator />

                          {/* Poll Interval */}
                          <div className="space-y-3">
                            <Label htmlFor="poll-interval">
                              Check Interval
                            </Label>
                            <Select
                              value={settings.pollIntervalMinutes.toString()}
                              onValueChange={(value) => {
                                saveSettings({ pollIntervalMinutes: parseInt(value) })
                              }}
                              disabled={settingsSaving}
                            >
                              <SelectTrigger id="poll-interval" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">Every 5 minutes</SelectItem>
                                <SelectItem value="15">Every 15 minutes</SelectItem>
                                <SelectItem value="30">Every 30 minutes</SelectItem>
                                <SelectItem value="60">Every hour</SelectItem>
                                <SelectItem value="120">Every 2 hours</SelectItem>
                                <SelectItem value="360">Every 6 hours</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              How often to check for new files in your Drive folder
                            </p>
                          </div>
                        </>
                      )}

                      <Separator />

                      {/* Manual Poll */}
                      <div className="space-y-3">
                        <Label>Manual Check</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => handleManualPoll(false, false)}
                            disabled={polling !== null}
                          >
                            {polling === 'quick' ? (
                              <>
                                <Spinner size={16} className="text-primary" />
                                Checking...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                Quick Check
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => handleManualPoll(false, true)}
                            disabled={polling !== null}
                          >
                            {polling === 'full' ? (
                              <>
                                <Spinner size={16} className="text-primary" />
                                Checking...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                Full Sync
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quick Check: Recent files only • Full Sync: All files (slower)
                        </p>

                        {pollResult && (
                          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                            <p className="font-medium">Poll Results:</p>
                            <p className="text-muted-foreground">
                              ✓ {pollResult.imported} imported, {pollResult.skipped} skipped, {pollResult.errors} errors
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Ask AI Tab Content */}
          {activeTab === 'ask' && (
            <div
              className="animate-fade-in flex flex-col relative"
              style={{ height: messages.length > 0 ? 'calc(100vh - 180px)' : 'calc(100vh - 240px)' }}
            >
              <div className="flex-1 overflow-y-auto pb-32 relative">
                <div className="sticky top-0 left-0 right-0 h-24 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none z-30 -mb-24" />
                <div className="max-w-3xl mx-auto px-4 pt-8">
                  {/* Empty State */}
                  {messages.length === 0 && !asking ? (
                    <div className="flex flex-col items-center justify-center text-center py-24 min-h-[50vh]">
                      <div className="mb-6 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 animate-float">
                        <MagicWandIcon size={28} className="text-primary" />
                      </div>
                      <h3 className="text-2xl font-semibold text-foreground mb-3 animate-fade-in" style={{ animationDelay: '100ms' }}>Ask AI about your candidates</h3>
                      <p className="text-muted-foreground max-w-md mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
                        Get instant insights from all your interviews.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center animate-fade-in" style={{ animationDelay: '300ms' }}>
                        {[
                          "Compare the top candidates",
                          "Who has the most experience?"
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
                      {/* Render all messages */}
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

                      {/* Loading indicator for new response */}
                      {asking && (
                        <Message from="assistant" className="animate-fade-in-right">
                          <div className="h-8 w-8 rounded-full bg-peach/20 flex items-center justify-center flex-shrink-0 border border-peach/30 animate-glow-pulse">
                            <MagicWandIcon size={14} className="text-primary animate-pulse" />
                          </div>
                          <MessageContent variant="flat">
                            <div className="flex items-center gap-3 py-2">
                              <ShimmeringText
                                text="Analyzing your meetings..."
                                className="text-sm text-muted-foreground"
                              />
                            </div>
                          </MessageContent>
                        </Message>
                      )}

                      {/* Clear conversation button */}
                      {messages.length > 0 && !asking && (
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={clearConversation}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Start new conversation
                          </button>
                        </div>
                      )}

                      {/* Scroll anchor */}
                      <div ref={conversationEndRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Input Area - Fixed at bottom, OUTSIDE the animated container */}
          {activeTab === 'ask' && (
            <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-8" style={{ background: 'linear-gradient(to top, hsl(var(--background)) 70%, transparent)' }}>
              <div className="max-w-2xl mx-auto">
                <div className="relative group">
                  {/* Main input container - subtle, integrated styling */}
                  <div className="relative bg-card/60 backdrop-blur-md border border-border/30 rounded-xl shadow-lg transition-all duration-300 group-focus-within:border-primary/30 group-focus-within:shadow-xl overflow-hidden min-h-[54px] flex flex-col justify-end">
                    <form onSubmit={handleAskQuestion} className="flex items-end gap-2">
                      {/* Voice recorder */}
                      <div className="flex items-center pl-3 pb-2.5 h-[54px]">
                        <VoiceRecorder
                          onTranscriptionComplete={(text) => setAiQuestion(prev => prev ? `${prev} ${text}` : text)}
                          onRecordingChange={setIsRecording}
                        />
                      </div>

                      {!isRecording && (
                        <>
                          {/* Text input */}
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
                              placeholder={messages.length > 0 ? "Ask follow-up..." : "Ask a question about your meetings..."}
                              className="min-h-[44px] max-h-[160px] py-2.5 px-4 border-0 bg-input focus-visible:ring-0 focus-visible:ring-offset-0 resize-none overflow-y-auto text-[15px] placeholder:text-muted-foreground/50"
                              rows={1}
                            />
                          </div>

                          {/* Send button */}
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
          )}

          {/* Meetings Tab Content */}
          {activeTab === 'meetings' && (
            <div className="animate-fade-in">
              {/* Quick Stats Bar */}
              {!loading && meetings.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 md:mb-12">
                  <div className="border border-border/40 bg-gradient-to-br from-card/40 to-card/20 rounded-2xl p-5 md:p-7 flex flex-col justify-between h-32 md:h-44 hover:bg-card/50 hover:border-border/60 hover:shadow-lg transition-all duration-300 relative group">
                    <div className="space-y-2 md:space-y-3">
                      <p className="text-4xl md:text-5xl font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">
                        {hasActiveFilters ? filteredMeetings.length : totalCount}
                      </p>
                      <p className="text-sm font-normal font-sans">
                        {hasActiveFilters ? 'Filtered' : 'Total'} Meetings
                      </p>
                    </div>
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 h-8 w-8 md:h-10 md:w-10 rounded-xl bg-peach/10 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 text-peach" />
                    </div>
                  </div>

                  <div className="border border-border/40 bg-gradient-to-br from-card/40 to-card/20 rounded-2xl p-5 md:p-7 flex flex-col justify-between h-32 md:h-44 hover:bg-card/50 hover:border-border/60 hover:shadow-lg transition-all duration-300 relative group">
                    <div className="space-y-2 md:space-y-3">
                      <p className="text-4xl md:text-5xl font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">
                        {new Set(filteredMeetings.map(i => i.candidate_name)).size}
                      </p>
                      <p className="text-sm font-normal font-sans">Participants</p>
                    </div>
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary/10 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                      <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                  </div>

                  <div className="border border-border/40 bg-gradient-to-br from-card/40 to-card/20 rounded-2xl p-5 md:p-7 flex flex-col justify-between h-32 md:h-44 hover:bg-card/50 hover:border-border/60 hover:shadow-lg transition-all duration-300 relative group">
                    <div className="space-y-2 md:space-y-3">
                      <p className="text-4xl md:text-5xl font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">
                        {filteredMeetings.filter((i: Meeting) => {
                          const date = new Date(i.meeting_date || i.created_at)
                          const weekAgo = new Date()
                          weekAgo.setDate(weekAgo.getDate() - 7)
                          return date > weekAgo
                        }).length}
                      </p>
                      <p className="text-sm font-normal font-sans">This Week</p>
                    </div>
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 h-8 w-8 md:h-10 md:w-10 rounded-xl bg-peach/10 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                      <Calendar className="h-4 w-4 md:h-5 md:w-5 text-peach" />
                    </div>
                  </div>

                  <div className="border border-border/40 bg-gradient-to-br from-card/40 to-card/20 rounded-2xl p-5 md:p-7 flex flex-col justify-between h-32 md:h-44 hover:bg-card/50 hover:border-border/60 hover:shadow-lg transition-all duration-300 relative group">
                    <div className="space-y-2 md:space-y-3">
                      <p className="text-4xl md:text-5xl font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">
                        {new Set(filteredMeetings.map((i: Meeting) => i.position).filter(Boolean)).size}
                      </p>
                      <p className="text-sm font-normal font-sans">Positions</p>
                    </div>
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary/10 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                  </div>
                </div>
              )}

              {/* Search and Toolbar */}
              <div className="sticky top-40 z-10 bg-background/95 backdrop-blur-sm pb-4 pt-2 mb-2 border-b border-border/40">
                <div className="flex flex-col gap-4">
                  {/* Top Row: Search and Actions */}
                  <div className="flex flex-col sm:flex-row gap-6 justify-between items-center">
                    <div className="flex items-center gap-4 w-full sm:max-w-2xl">
                      <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name, position, or keywords..."
                          className="pl-11 pr-4 h-12 bg-input border-transparent rounded-full transition-all focus:bg-background focus:shadow-sm focus:border-primary/30 text-base"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => { setSearchQuery(''); fetchMeetings(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFiltersOpen(true)}
                        className={cn(
                          "rounded-full h-12 px-4 border-border/60 hover:bg-secondary/30 hover:border-border gap-2",
                          hasActiveFilters && "bg-primary/10 border-primary/30 text-primary hover:text-primary"
                        )}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only">Filters</span>
                        {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">On</Badge>}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchMeetings()}
                        disabled={loading}
                        className="rounded-full h-12 px-4 border-border/60 hover:bg-secondary/30 hover:border-border text-muted-foreground hover:text-foreground gap-2"
                        title="Refresh meetings list"
                      >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin-slow")} />
                        <span className="sr-only sm:not-sr-only">Refresh</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenerateConfirm(true)}
                        disabled={regenerating}
                        className="rounded-full h-12 px-4 border-border/60 hover:bg-secondary/30 hover:border-border text-muted-foreground hover:text-foreground gap-2 ml-auto sm:ml-0"
                        title="Regenerate all summaries"
                      >
                        <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin-slow")} />
                        <span className="sr-only sm:not-sr-only">{regenerating ? "Regenerating..." : "Reanalyze"}</span>
                      </Button>

                      <div className="h-6 w-px bg-border/40 mx-1 hidden sm:block" />

                      <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap hidden sm:flex">
                        <span>Sorted by</span>
                        <span className="font-medium text-foreground">
                          {sortBy === 'date-desc' && 'Most Recent'}
                          {sortBy === 'date-asc' && 'Oldest First'}
                          {sortBy === 'name-asc' && 'Name (A-Z)'}
                          {sortBy === 'name-desc' && 'Name (Z-A)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Meeting Type Filters */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                      type="button"
                      onClick={() => setSelectedMeetingType('all')}
                      className={cn(
                        "px-4 py-1.5 text-xs rounded-full transition-all font-medium whitespace-nowrap flex items-center gap-2",
                        selectedMeetingType === 'all'
                          ? "bg-peach text-foreground"
                          : "bg-card/40 text-muted-foreground hover:bg-card/60 hover:text-foreground border border-border/40"
                      )}
                    >
                      <span>All</span>
                      <span className={cn(
                        "h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all",
                        selectedMeetingType === 'all'
                          ? "bg-foreground/15 text-foreground"
                          : "bg-muted/60 text-muted-foreground"
                      )}>
                        {hasActiveFilters ? filteredMeetings.length : totalCount}
                      </span>
                    </button>
                    {['Interview', 'Client Debrief', 'Sales Meeting', 'Status Update', 'Team Sync', '1-on-1', 'Client Call', 'Other'].map(type => {
                      const count = meetings
                        .filter(meeting => {
                          // Apply all filters except meeting type
                          if (dateRange !== 'all') {
                            const meetingDate = new Date(meeting.meeting_date || meeting.created_at)
                            const now = new Date()

                            if (dateRange === '7days') {
                              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                              if (meetingDate < weekAgo) return false
                            } else if (dateRange === '30days') {
                              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                              if (meetingDate < monthAgo) return false
                            } else if (dateRange === '3months') {
                              const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                              if (meetingDate < threeMonthsAgo) return false
                            }
                          }

                          if (selectedPosition !== 'all' && meeting.position !== selectedPosition) return false
                          if (selectedInterviewer !== 'all' && meeting.interviewer !== selectedInterviewer) return false
                          if (selectedCandidate !== 'all' && meeting.candidate_name !== selectedCandidate) return false

                          return meeting.meeting_type === type
                        }).length
                      if (count === 0) return null
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedMeetingType(type)}
                          className={cn(
                            "px-4 py-1.5 text-xs rounded-full transition-all font-medium whitespace-nowrap flex items-center gap-2",
                            selectedMeetingType === type
                              ? "bg-peach text-foreground"
                              : "bg-card/40 text-muted-foreground hover:bg-card/60 hover:text-foreground border border-border/40"
                          )}
                        >
                          <span>{type}</span>
                          <span className={cn(
                            "h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all",
                            selectedMeetingType === type
                              ? "bg-foreground/15 text-foreground"
                              : "bg-muted/60 text-muted-foreground"
                          )}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Selection Bar - appears when items are selected */}
                  {selectedMeetings.size > 0 && (
                    <div className="flex items-center justify-between gap-4 py-3 px-4 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={allFilteredSelected ? deselectAllMeetings : selectAllMeetings}
                          className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                        >
                          {allFilteredSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : someFilteredSelected ? (
                            <MinusSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                          <span className="font-medium">
                            {allFilteredSelected ? 'Deselect All' : 'Select All'}
                          </span>
                        </button>
                        <div className="h-4 w-px bg-border/60" />
                        <span className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{selectedMeetings.size}</span> selected
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllMeetings}
                          className="text-muted-foreground hover:text-foreground h-8 px-3"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          className="gap-2 h-8 px-4"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete ({selectedMeetings.size})
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Header (Hidden if sticky toolbar is used, or keep for spacing) */}
              <div className="h-4" />

              {/* Interviews List */}
              <div className="flex flex-col gap-6">
                {loading ? (
                  /* Skeleton Loading State */
                  [1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border border-border/40 rounded-2xl p-5 md:p-8 bg-card/40 animate-pulse">
                      <div className="flex flex-col sm:flex-row gap-4 md:gap-5">
                        {/* Left: Avatar and Name Skeleton */}
                        <div className="flex flex-col gap-2 sm:gap-3">
                          {/* Avatar and Name Horizontal */}
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex-shrink-0" />
                            <Skeleton className="h-5 w-32 rounded-full" />
                          </div>
                          {/* Role Tag Skeleton */}
                          <Skeleton className="h-5 w-24 rounded-full opacity-60" />
                          {/* Mobile Date Skeleton */}
                          <Skeleton className="sm:hidden h-3 w-20 rounded-full opacity-60" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-4">
                          {/* Header Row Skeleton - Just date on desktop */}
                          <div className="hidden sm:flex items-start justify-between gap-4">
                            <Skeleton className="h-4 w-24 rounded-full opacity-50 ml-auto" />
                          </div>

                          {/* Summary Skeleton */}
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full rounded-full opacity-60" />
                            <Skeleton className="h-4 w-3/4 rounded-full opacity-60" />
                          </div>

                          {/* Tags Skeleton */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/30">
                            <div className="flex gap-2">
                              <Skeleton className="h-6 w-20 rounded-full opacity-50" />
                              <Skeleton className="h-6 w-24 rounded-full opacity-50" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : meetings.length === 0 ? (
                  <div className="col-span-full">
                    <Card className="py-20 border-dashed border-2 bg-card/30">
                      <div className="text-center">
                        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                          <FileText className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">No meetings yet</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                          Import your meeting transcripts from Google Drive to start building your meeting library.
                        </p>
                        <Button onClick={() => setImportOpen(true)} className="gap-2">
                          <CloudDownload className="h-4 w-4" />
                          Import from Drive
                        </Button>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <>
                    {filteredMeetings.map((meeting, index) => (
                      <div
                        key={meeting.id}
                        className={cn(
                          "group relative border rounded-2xl p-5 md:p-8 bg-card/30 hover:bg-card/50 transition-all duration-300 hover:shadow-lg cursor-pointer",
                          selectedMeetings.has(meeting.id)
                            ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                            : "border-border/40 hover:border-border/60"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => router.push(`/history/${meeting.id}`)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleMeetingSelection(meeting.id)
                            }}
                            className={cn(
                              "h-6 w-6 mt-4 rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                              selectedMeetings.has(meeting.id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border/60 hover:border-primary/50 bg-background/50"
                            )}
                          >
                            {selectedMeetings.has(meeting.id) && (
                              <Check className="h-4 w-4" />
                            )}
                          </button>

                          <div className="flex flex-col flex-1">
                            {/* Top Row: Avatar, Name, and Date */}
                            <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Avatar */}
                                <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-peach/30 to-peach/10 flex items-center justify-center shrink-0 border border-peach/20 shadow-sm">
                                  <span className="text-sm md:text-base font-semibold text-foreground tracking-tight">
                                    {(meeting.candidate_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                {/* Name / Meeting Title */}
                                <h3 className="text-lg sm:text-xl font-normal text-foreground leading-tight group-hover:text-primary transition-colors duration-200 truncate">
                                  {meeting.meeting_title && meeting.meeting_title !== 'Interview'
                                    ? meeting.meeting_title
                                    : meeting.candidate_name || 'Unknown Participant'}
                                </h3>
                              </div>
                              {/* Date - Always visible on the right */}
                              <time className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0">
                                {(() => {
                                  const date = new Date(meeting.meeting_date || meeting.created_at)
                                  const today = new Date()
                                  const yesterday = new Date(today)
                                  yesterday.setDate(yesterday.getDate() - 1)

                                  if (date.toDateString() === today.toDateString()) return 'Today'
                                  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
                                  return date.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
                                  })
                                })()}
                              </time>
                            </div>

                            {/* Role Tag Below */}
                            {meeting.position && !meeting.position.match(/^\d+\s*-\s*(Strong Hire|Hire|No Hire|Definitely Not)/i) && meeting.position !== 'Uncategorized' && (
                              <div className="mb-3">
                                <span className="text-xs md:text-sm text-muted-foreground font-medium px-2.5 py-0.5 md:px-3 md:py-1 border border-border/50 rounded-full bg-muted/30 w-fit">
                                  {(() => {
                                    const { role, company } = formatRoleAndCompany(meeting.position)
                                    return company ? `${role} • ${company}` : role
                                  })()}
                                </span>
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Summary */}
                              {meeting.summary &&
                                !meeting.summary.startsWith('Interview conversation between') &&
                                meeting.summary !== 'Imported from Drive' ? (
                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                                  {meeting.summary}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground/60 leading-relaxed line-clamp-2 mb-4 italic">
                                  No summary available
                                </p>
                              )}

                              {/* Tags & Meta Row */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/30">
                                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                                  {meeting.meeting_type && (
                                    <Badge variant="secondary" className="text-xs font-medium px-3 py-1 bg-peach/20 text-foreground border-0 rounded-full h-7">
                                      {meeting.meeting_type}
                                    </Badge>
                                  )}
                                  {meeting.interviewer && meeting.interviewer !== 'Unknown' && (
                                    <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium h-7">
                                      <Avatar className="h-4 w-4 border border-border/40">
                                        <AvatarImage
                                          src={session?.user?.image || undefined}
                                          alt={session?.user?.name || 'User'}
                                        />
                                        <AvatarFallback className="text-[8px] font-semibold bg-muted/50 text-foreground/70">
                                          {viewerInitials || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      {meeting.interviewer}
                                    </Badge>
                                  )}
                                  {/* Submission Status Badge - Only for Interviews */}
                                  {meeting.meeting_type === 'Interview' && (() => {
                                    const isSubmitted = Boolean((meeting as any)?.submitted_at || (meeting as any)?.candidate_id)
                                    const submittedAt = (meeting as any)?.submitted_at

                                    const badge = (
                                      <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium h-7",
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
                                    )

                                    if (isSubmitted && submittedAt) {
                                      const date = new Date(submittedAt)
                                      const formattedDate = date.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                      })

                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            {badge}
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Feedback submitted</p>
                                            <p className="text-xs font-medium">{formattedDate}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )
                                    }

                                    return badge
                                  })()}
                                  {meeting.similarity && (
                                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border-0 rounded-full">
                                      {Math.round(meeting.similarity * 100)}% Match
                                    </Badge>
                                  )}
                                </div>

                                {/* Delete and Arrow indicators */}
                                <div className="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0">
                                  {/* Delete Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteMeeting(meeting)
                                    }}
                                    disabled={deletingId === meeting.id}
                                    className={cn(
                                      "h-8 w-8 rounded-full flex items-center justify-center",
                                      "bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 hover:border-destructive/30",
                                      "text-destructive hover:text-destructive",
                                      "transition-all duration-300 ease-out",
                                      // Mobile: always visible, Desktop: hover visible
                                      "opacity-100 sm:opacity-0 scale-100 sm:scale-75 sm:group-hover:opacity-100 sm:group-hover:scale-100",
                                      "hover:scale-110 active:scale-95",
                                      "shadow-sm hover:shadow-md",
                                      deletingId === meeting.id && "opacity-50 cursor-not-allowed"
                                    )}
                                    title="Delete meeting"
                                  >
                                    {deletingId === meeting.id ? (
                                      <div className="h-4 w-4 rounded-full border-2 border-destructive/30 border-t-destructive animate-spin-medium" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>

                                  {/* Arrow indicator */}
                                  <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 transform translate-x-0 sm:-translate-x-2 sm:group-hover:translate-x-0">
                                    <ChevronRight className="h-4 w-4 text-foreground" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Infinite Scroll Trigger */}
                    {hasMore && !loading && (
                      <div ref={loadMoreRef} className="py-8 flex justify-center">
                        {loadingMore ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner size={16} />
                            <span className="text-sm">Loading more meetings...</span>
                          </div>
                        ) : (
                          <div className="h-4" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Confirm Dialog for Regenerating Summaries */}
        <ConfirmDialog
          open={showRegenerateConfirm}
          onOpenChange={setShowRegenerateConfirm}
          title="Reanalyze All Meetings?"
          description="This will re-analyze all meetings using AI to generate intelligent titles (e.g., 'Jane Doe <> Adam Perlis — Interview 01/14/2025'), updated summaries, categories, and metadata. This process may take a few minutes."
          confirmLabel="Reanalyze"
          cancelLabel="Cancel"
          onConfirm={handleRegenerateSummaries}
          loading={regenerating}
        />

        {/* Confirm Dialog for Delete */}
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete Meeting?"
          description={meetingToDelete ? `Are you sure you want to delete the meeting with ${meetingToDelete.candidate_name}? This action cannot be undone.` : ''}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          loading={false}
        />

        {/* Confirm Dialog for Bulk Delete */}
        <ConfirmDialog
          open={showBulkDeleteConfirm}
          onOpenChange={setShowBulkDeleteConfirm}
          title={`Delete ${selectedMeetings.size} Meeting${selectedMeetings.size === 1 ? '' : 's'}?`}
          description={`Are you sure you want to delete ${selectedMeetings.size} selected meeting${selectedMeetings.size === 1 ? '' : 's'}? This action cannot be undone.`}
          confirmLabel={`Delete ${selectedMeetings.size}`}
          cancelLabel="Cancel"
          onConfirm={handleBulkDelete}
          loading={bulkDeleting}
        />
      </div>
    </div>
  </TooltipProvider>
  )
}

