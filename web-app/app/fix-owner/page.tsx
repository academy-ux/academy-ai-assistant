'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FixOwnerPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const router = useRouter()

  async function runFix() {
    setRunning(true)
    setResult(null)

    try {
      const res = await fetch('/api/fix-owner-email', {
        method: 'POST',
      })

      const data = await res.json()
      setResult(data)
      
      if (data.success) {
        setTimeout(() => {
          router.push('/history')
        }, 3000)
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Fix Missing Transcripts</h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">What this does:</h2>
          <p className="text-sm text-blue-800">
            This will set the <code className="bg-blue-100 px-1 rounded">owner_email</code> field 
            for all transcripts that were imported from Google Drive but don't have an owner assigned yet. 
            This will make them show up in your History and Feedback pages.
          </p>
        </div>

        {result && (
          <div className={`rounded-lg p-4 mb-6 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.success ? (
              <>
                <p className="text-sm text-green-800 font-semibold mb-2">
                  ✅ Updated {result.updated} transcript{result.updated !== 1 ? 's' : ''}!
                </p>
                {result.records && result.records.length > 0 && (
                  <ul className="text-xs text-green-700 ml-4 space-y-1">
                    {result.records.map((title: string, idx: number) => (
                      <li key={idx}>• {title}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-green-600 mt-3">Redirecting to History...</p>
              </>
            ) : (
              <p className="text-sm text-red-800">
                ❌ {result.error || 'Fix failed'}
              </p>
            )}
          </div>
        )}

        <button
          onClick={runFix}
          disabled={running}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {running ? 'Fixing...' : 'Fix My Transcripts'}
        </button>

        <button
          onClick={() => router.push('/history')}
          className="w-full mt-3 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          Go to History
        </button>
      </div>
    </div>
  )
}
