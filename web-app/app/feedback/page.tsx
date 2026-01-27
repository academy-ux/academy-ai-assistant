'use client'

import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

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
  const [selectedTemplate, setSelectedTemplate] = useState('')

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

    try {
      const res = await fetch('/api/lever/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedCandidate,
          templateId: selectedTemplate,
          feedback: formData,
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Sign in Required</h1>
          <p className="text-gray-600 mb-6">
            Sign in with Google to access your Meet transcripts
          </p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-xl font-bold mb-2">Feedback Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted to Lever.
          </p>
          <button
            onClick={() => window.close()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg"
          >
            Close Tab
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Academy Interview Assistant
          </h1>
          <span className="text-sm text-gray-500">
            {meetingTitle || meetingCode || 'Interview'} - {new Date().toLocaleDateString()}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Transcript */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Interview Transcript</h2>
              {transcriptFileName && (
                <span className="text-xs text-gray-500">From Google Drive</span>
              )}
            </div>
            <div className="p-6">
              {transcriptLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    {countdown > 0 ? 'Waiting for transcript...' : 'Searching Google Drive...'}
                  </h3>
                  {countdown > 0 && (
                    <p className="text-3xl font-bold text-blue-500 mb-2">{countdown}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {retryCount > 0 ? `Attempt ${retryCount + 1}/7` : 'Transcripts take 1-2 min to appear'}
                  </p>
                </div>
              ) : transcriptError ? (
                <div className="text-center py-12">
                  <div className="text-red-500 text-4xl mb-4">!</div>
                  <h3 className="font-medium text-gray-900 mb-2">Could not find transcript</h3>
                  <p className="text-sm text-gray-500 mb-4">{transcriptError}</p>
                  <button
                    onClick={() => {
                      setTranscriptError('')
                      setTranscriptLoading(true)
                      setRetryCount(0)
                      setCountdown(5)
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div>
                  {transcriptFileName && (
                    <p className="text-sm text-gray-500 mb-3">
                      <strong>File:</strong> {transcriptFileName}
                    </p>
                  )}
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {transcript}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Feedback Form */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Feedback Form</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Lever matching */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Match to Lever
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Candidate
                    </label>
                    <select
                      value={selectedCandidate}
                      onChange={e => setSelectedCandidate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a candidate...</option>
                      {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.position}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Feedback Template
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={e => setSelectedTemplate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Feedback fields */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Feedback
                </h3>

                {analysisLoading ? (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    <span className="text-blue-700">Analyzing transcript with AI...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Overall Rating
                      </label>
                      <select
                        value={formData.rating}
                        onChange={e => setFormData({ ...formData, rating: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option>4 - Strong Hire</option>
                        <option>3 - Hire</option>
                        <option>2 - No Hire</option>
                        <option>1 - Strong No Hire</option>
                      </select>
                      {analysis?.alternativeRatings && analysis.alternativeRatings.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {analysis.alternativeRatings.map((alt, i) => (
                            <button
                              key={i}
                              onClick={() => setFormData({ ...formData, rating: alt.rating })}
                              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
                              title={alt.reasoning}
                            >
                              {alt.rating}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Strengths
                      </label>
                      <textarea
                        value={formData.strengths}
                        onChange={e => setFormData({ ...formData, strengths: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Concerns
                      </label>
                      <textarea
                        value={formData.concerns}
                        onChange={e => setFormData({ ...formData, concerns: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Technical Skills
                      </label>
                      <textarea
                        value={formData.technicalSkills}
                        onChange={e => setFormData({ ...formData, technicalSkills: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cultural Fit
                      </label>
                      <textarea
                        value={formData.culturalFit}
                        onChange={e => setFormData({ ...formData, culturalFit: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recommendation
                      </label>
                      <textarea
                        value={formData.recommendation}
                        onChange={e => setFormData({ ...formData, recommendation: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    {analysis?.keyQuotes && analysis.keyQuotes.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Key Quotes
                        </label>
                        <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                          {analysis.keyQuotes.map((q, i) => (
                            <p key={i} className="text-sm text-gray-600 italic mb-2 last:mb-0">
                              "{q}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  {selectedCandidate && selectedTemplate
                    ? 'Ready to submit'
                    : 'Select candidate and template'}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedCandidate || !selectedTemplate || submitting || analysisLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit to Lever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  )
}
