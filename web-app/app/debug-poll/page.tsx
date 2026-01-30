'use client'

import { useEffect, useState } from 'react'

export default function DebugPollPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchDebugInfo() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug-poll')
      const json = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        setError(json.error || 'Failed to fetch')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebugInfo()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking Drive folder...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-900 mb-2">Error</h1>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchDebugInfo}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Poll Debug Info</h1>
          <button
            onClick={fetchDebugInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Files (48h)</div>
            <div className="text-3xl font-bold text-gray-900">{data?.totalFiles || 0}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <div className="text-sm text-green-700 mb-1">Already Imported</div>
            <div className="text-3xl font-bold text-green-900">{data?.alreadyImported || 0}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="text-sm text-blue-700 mb-1">New Files</div>
            <div className="text-3xl font-bold text-blue-900">{data?.newFiles || 0}</div>
          </div>
        </div>

        {/* Folder Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Folder Info</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Folder:</span> {data?.folderName}</div>
            <div><span className="font-medium">Folder ID:</span> <code className="bg-gray-100 px-2 py-1 rounded">{data?.folderId}</code></div>
            <div><span className="font-medium">Checking files since:</span> {new Date(data?.checkingSince).toLocaleString()}</div>
          </div>
        </div>

        {/* Files List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Files in Past 48 Hours</h2>
          </div>
          
          {data?.files && data.files.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {data.files.map((file: any, idx: number) => (
                <div key={idx} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900">{file.name}</h3>
                        {file.alreadyImported ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Imported
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            ⭐ New
                          </span>
                        )}
                      </div>
                      
                      {file.importedAs && (
                        <div className="text-sm text-gray-600 mb-2">
                          Imported as: <span className="font-medium">{file.importedAs}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-2">
                        <div>
                          <span className="font-medium">Created:</span> {new Date(file.created).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Modified:</span> {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        ID: <code>{file.id}</code>
                      </div>
                    </div>
                    
                    {file.link && (
                      <a
                        href={file.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        View in Drive
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium mb-2">No files found</p>
              <p className="text-sm">No Google Docs found in your configured folder from the past 48 hours.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
