'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronsUpDown, Check, Search, CloudDownload } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export default function HistoryPage() {
  const { data: session } = useSession()
  // ... existing state ...
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'list' | 'ask'>('list')
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [asking, setAsking] = useState(false)

  // Uncategorized Candidates State
  const [uncategorizedCandidates, setUncategorizedCandidates] = useState<UncategorizedCandidate[]>([])
  const [uncategorizedLoading, setUncategorizedLoading] = useState(false)

  // Import State
  const [importOpen, setImportOpen] = useState(false)
  const [folders, setFolders] = useState<{id: string, name: string}[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{name: string, status: string}[]>([])
  
  // Folder search state
  const [folderSearch, setFolderSearch] = useState('')
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderSearchLoading, setFolderSearchLoading] = useState(false)
  
  // Debounce folder search
  useEffect(() => {
    if (!importOpen) return

    const timer = setTimeout(() => {
      fetchFolders(folderSearch)
    }, 300)

    return () => clearTimeout(timer)
  }, [folderSearch, importOpen])

  useEffect(() => {
    fetchInterviews()
    fetchUncategorizedCandidates()
  }, [])

  // ... other existing functions ...

  async function fetchFolders(query: string = '') {
    setFolderSearchLoading(true)
    // Only clear folders if it's a new search, not initial load
    if (query) setFoldersError('')
    
    try {
      const res = await fetch(`/api/drive/folders?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      console.log('Folders response:', data)
      if (data.error) {
        setFoldersError(data.error)
      } else if (data.folders) {
        setFolders(data.folders)
        
        // Auto-select "Meet Recordings" if found and no folder selected yet
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

  // ... handleImport ...

  async function handleImport() {
    if (!selectedFolder) return
    setImporting(true)
    setImportResults([])
    
    try {
      const res = await fetch('/api/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: selectedFolder })
      })
      const data = await res.json()
      
      if (data.results) {
        setImportResults(data.results)
        fetchInterviews() // Refresh list
      }
    } catch (error) {
      console.error('Import failed', error)
    } finally {
      setImporting(false)
    }
  }

  async function fetchInterviews() {
    try {
      setLoading(true)
      const res = await fetch('/api/interviews')
      const data = await res.json()
      if (data.interviews) {
        setInterviews(data.interviews)
      }
    } catch (error) {
      console.error('Failed to fetch interviews', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      fetchInterviews()
      return
    }

    if (searchMode === 'ask') {
      await handleAskQuestion()
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/interviews/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })
      const data = await res.json()
      if (data.results) {
        setInterviews(data.results)
      }
    } catch (error) {
      console.error('Search failed', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAskQuestion() {
    try {
      setAsking(true)
      setAnswer(null)
      setSources([])
      
      const res = await fetch('/api/interviews/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: searchQuery })
      })
      const data = await res.json()
      
      setAnswer(data.answer)
      setSources(data.sources || [])
    } catch (error) {
      console.error('Ask failed', error)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Interview History</h1>
            <p className="text-muted-foreground mt-2">Search past interviews or ask AI for insights.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CloudDownload className="h-4 w-4" />
                  Import from Drive
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Import Meeting Transcripts</DialogTitle>
                  <DialogDescription>
                    Select a Google Drive folder containing your transcripts. We'll analyze and index them automatically.
                  </DialogDescription>
                </DialogHeader>
                
                {!importing && importResults.length === 0 && (
                  <div className="py-4 space-y-4">
                    {foldersLoading && !folderSearchLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner variant="infinite" className="text-primary" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
                      </div>
                    ) : foldersError ? (
                      <div className="text-sm text-destructive py-4">
                        Error: {foldersError}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Select Folder
                        </label>
                        <Popover open={folderOpen} onOpenChange={setFolderOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={folderOpen}
                              className="w-full justify-between"
                            >
                              {selectedFolder
                                ? folders.find((folder) => folder.id === selectedFolder)?.name
                                : "Select folder..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <div className="p-2 border-b border-border/50">
                              <div className="flex items-center gap-2 px-2">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Input
                                  placeholder="Search Drive folders..."
                                  value={folderSearch}
                                  onChange={(e) => setFolderSearch(e.target.value)}
                                  className="h-8 border-0 focus-visible:ring-0 p-0 text-sm"
                                />
                                {folderSearchLoading && <Spinner size={16} />}
                              </div>
                            </div>
                            <ScrollArea className="h-[200px]">
                              {folders.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                  No folders found.
                                </div>
                              ) : (
                                <div className="p-1">
                                  {folders.map((folder) => (
                                    <div
                                      key={folder.id}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-2.5 rounded-md cursor-pointer transition-colors",
                                        "hover:bg-muted/50",
                                        selectedFolder === folder.id && "bg-muted"
                                      )}
                                      onClick={() => {
                                        setSelectedFolder(folder.id)
                                        setFolderOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 text-primary",
                                          selectedFolder === folder.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="truncate">{folder.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">
                          We recommend selecting your <strong>"Meet Recordings"</strong> folder.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {importing && (
                  <div className="py-8 flex flex-col items-center justify-center gap-4">
                    <Spinner size={32} />
                    <p className="text-sm text-muted-foreground">Importing and analyzing...</p>
                  </div>
                )}

                {importResults.length > 0 && (
                  <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                    <div className="space-y-2">
                      {importResults.map((res, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="truncate max-w-[200px]">{res.name}</span>
                          <Badge variant={res.status === 'imported' ? 'default' : 'secondary'}>
                            {res.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <DialogFooter>
                  {!importing && importResults.length === 0 && (
                    <Button onClick={handleImport} disabled={!selectedFolder}>
                      Start Import
                    </Button>
                  )}
                  {importResults.length > 0 && (
                    <Button onClick={() => setImportOpen(false)}>Done</Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" asChild>
              <Link href="/feedback">
                ← Back to Feedback
              </Link>
            </Button>
          </div>
        </div>

        {/* Uncategorized Candidates Alert */}
        {/* {uncategorizedCandidates.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-amber-800">
                    Uncategorized Candidates
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    {uncategorizedCandidates.length} candidate{uncategorizedCandidates.length > 1 ? 's' : ''} without a job assignment in Lever
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  Needs Review
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {uncategorizedCandidates.slice(0, 10).map((candidate) => (
                  <a
                    key={candidate.id}
                    href={`https://hire.lever.co/candidates/${candidate.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-amber-200 rounded text-sm hover:bg-amber-100 transition-colors"
                  >
                    <span className="font-medium text-foreground">{candidate.name}</span>
                    <span className="text-xs text-muted-foreground">• {candidate.stage}</span>
                  </a>
                ))}
                {uncategorizedCandidates.length > 10 && (
                  <span className="inline-flex items-center px-2 py-1 text-sm text-amber-700">
                    +{uncategorizedCandidates.length - 10} more
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )} */}

        {/* Search Bar */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchMode === 'list' ? "Search transcripts..." : "Ask a question about your candidates..."}
                  className="w-full"
                />
              </div>
              <Select 
                value={searchMode} 
                onValueChange={(value) => setSearchMode(value as 'list' | 'ask')}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Search Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">Search Interviews</SelectItem>
                  <SelectItem value="ask">Ask AI</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                type="submit"
                disabled={loading || asking}
                className="w-full md:w-auto"
              >
                {asking ? 'Thinking...' : 'Go'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* AI Answer Section */}
        {searchMode === 'ask' && answer && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
                {answer}
              </div>
              
              {sources.length > 0 && (
                <>
                  <Separator className="my-6 bg-primary/20" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Sources:</p>
                    <div className="flex gap-2 flex-wrap">
                      {sources.map(source => (
                        <Badge key={source.id} variant="outline" className="bg-background text-foreground hover:bg-background">
                          {source.candidateName} • {new Date(source.meetingDate).toLocaleDateString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interviews List */}
        {searchMode === 'list' && (
          <div className="grid gap-6">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading interviews...</div>
            ) : interviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No interviews found.</div>
            ) : (
              interviews.map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-xl font-bold">
                        {interview.candidate_name || 'Unknown Candidate'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {interview.position} • {interview.meeting_title}
                      </CardDescription>
                    </div>
                    {interview.similarity && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                        {Math.round(interview.similarity * 100)}% match
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-4">
                      {new Date(interview.created_at).toLocaleDateString()}
                    </div>
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm font-mono text-muted-foreground line-clamp-3">
                        {interview.transcript}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
