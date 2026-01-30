'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function DebugDrivePage() {
  const [fileUrl, setFileUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function debugFile() {
    // Extract file ID from URL
    const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (!match) {
      alert('Invalid Google Docs URL')
      return
    }
    
    const fileId = match[1]
    setLoading(true)
    
    try {
      const res = await fetch('/api/drive/debug-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })
      
      const data = await res.json()
      setResult(data)
    } catch (e) {
      console.error(e)
      alert('Debug failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Debug Drive File</h1>
      
      <div className="space-y-4 mb-8">
        <Input 
          placeholder="Paste Google Docs URL here"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
        />
        <Button onClick={debugFile} disabled={loading}>
          {loading ? 'Checking...' : 'Debug File'}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-bold mb-2">File Info</h2>
            <pre className="text-xs overflow-auto">{JSON.stringify(result.file, null, 2)}</pre>
          </Card>

          <Card className="p-4">
            <h2 className="font-bold mb-2">Your Settings</h2>
            <pre className="text-xs overflow-auto">{JSON.stringify(result.userSettings, null, 2)}</pre>
          </Card>

          <Card className="p-4">
            <h2 className="font-bold mb-2">Already Imported?</h2>
            <pre className="text-xs overflow-auto">{JSON.stringify(result.alreadyImported, null, 2)}</pre>
          </Card>

          <Card className="p-4">
            <h2 className="font-bold mb-2">Polling Checks</h2>
            <div className="space-y-2">
              {Object.entries(result.pollingChecks || {}).map(([key, check]: [string, any]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={check.value ? 'text-green-600' : 'text-red-600'}>
                    {check.value ? '✓' : '✗'}
                  </span>
                  <span>{key}</span>
                  {check.required && <span className="text-xs text-muted-foreground">(required)</span>}
                </div>
              ))}
            </div>
          </Card>

          <Card className={`p-4 ${result.wouldBeDetected ? 'bg-green-50' : 'bg-red-50'}`}>
            <h2 className="font-bold mb-2">
              {result.wouldBeDetected ? '✓ Would be detected by polling' : '✗ Would NOT be detected by polling'}
            </h2>
            {!result.wouldBeDetected && (
              <div className="text-sm space-y-2 mt-4">
                <p className="font-medium">Possible issues:</p>
                <ul className="list-disc list-inside space-y-1">
                  {!result.pollingChecks.isGoogleDoc.value && (
                    <li>File is not a Google Doc</li>
                  )}
                  {!result.pollingChecks.isNotTrashed.value && (
                    <li>File is in trash</li>
                  )}
                  {!result.pollingChecks.isInConfiguredFolder.value && (
                    <li>File is NOT in your configured Drive folder</li>
                  )}
                  {!result.pollingChecks.isAfterLastPoll.value && (
                    <li>File was not modified after your last poll (try full sync)</li>
                  )}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
