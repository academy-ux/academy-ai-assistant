import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const meetingTitle = searchParams.get('title') || ''
    const meetingCode = searchParams.get('code') || ''

    // Initialize Google Drive API
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.accessToken })

    const drive = google.drive({ version: 'v3', auth })

    // Search for recent transcript files (last 15 minutes)
    const cutoffTime = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // Build search queries
    const queries = [
      `name contains 'transcript' and mimeType = 'application/vnd.google-apps.document' and modifiedTime > '${cutoffTime}' and trashed = false`,
    ]

    // Add more specific queries if we have meeting info
    if (meetingTitle) {
      queries.unshift(
        `name contains '${meetingTitle.replace(/'/g, "\\'")}' and name contains 'transcript' and modifiedTime > '${cutoffTime}' and trashed = false`
      )
    }
    if (meetingCode) {
      queries.unshift(
        `name contains '${meetingCode}' and modifiedTime > '${cutoffTime}' and trashed = false`
      )
    }

    let transcriptFile = null

    for (const query of queries) {
      try {
        const response = await drive.files.list({
          q: query,
          orderBy: 'modifiedTime desc',
          pageSize: 5,
          fields: 'files(id, name, modifiedTime, mimeType)',
        })

        if (response.data.files && response.data.files.length > 0) {
          transcriptFile = response.data.files[0]
          break
        }
      } catch (e) {
        console.warn('Search query failed:', e)
      }
    }

    if (!transcriptFile) {
      return NextResponse.json({
        error: 'No transcript found',
        message: 'No transcript found in Google Drive. Make sure Meet transcription was enabled.'
      }, { status: 404 })
    }

    // Export the document as plain text
    const exportResponse = await drive.files.export({
      fileId: transcriptFile.id!,
      mimeType: 'text/plain',
    })

    const transcript = exportResponse.data as string

    return NextResponse.json({
      success: true,
      transcript,
      fileName: transcriptFile.name,
      fileId: transcriptFile.id,
      modifiedTime: transcriptFile.modifiedTime,
    })

  } catch (error: any) {
    console.error('Transcript fetch error:', error)
    return NextResponse.json({
      error: 'Failed to fetch transcript',
      message: error.message
    }, { status: 500 })
  }
}
