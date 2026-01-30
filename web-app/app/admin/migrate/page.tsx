'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MigratePage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const router = useRouter()

  async function runMigration() {
    if (!confirm('Run migration to add "Client Debrief" and other meeting types to the database constraint?')) {
      return
    }

    setRunning(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()
      setResult(data)
      
      if (data.success) {
        setTimeout(() => {
          router.push('/history')
        }, 2000)
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Database Migration</h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">What this does:</h2>
          <p className="text-sm text-blue-800 mb-2">
            This migration updates the <code className="bg-blue-100 px-1 rounded">meeting_type</code> constraint to allow the following values:
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li>• Interview</li>
            <li>• <strong>Client Debrief</strong> (currently failing)</li>
            <li>• Sales Meeting</li>
            <li>• Status Update</li>
            <li>• Planning Meeting</li>
            <li>• Team Sync</li>
            <li>• Client Call</li>
            <li>• 1-on-1</li>
            <li>• All Hands</li>
            <li>• Standup</li>
            <li>• Retrospective</li>
            <li>• Demo</li>
            <li>• Other</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Note:</strong> This will modify your database schema. Make sure you have admin access.
          </p>
        </div>

        {result && (
          <div className={`rounded-lg p-4 mb-6 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '✅' : '❌'} {result.message}
            </p>
          </div>
        )}

        <button
          onClick={runMigration}
          disabled={running}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {running ? 'Running Migration...' : 'Run Migration Now'}
        </button>

        <button
          onClick={() => router.push('/history')}
          className="w-full mt-3 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
