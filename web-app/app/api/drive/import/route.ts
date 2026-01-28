import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google, drive_v3 } from 'googleapis'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { z } from 'zod'
import { validateBody, errorResponse } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const importSchema = z.object({
  folderId: z.string()
    .min(1, 'Folder ID required')
    .max(100, 'Folder ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder ID format'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit import endpoints (very expensive)
    const { success, response: rateLimitResponse } = await checkRateLimit(req, 'import')
    if (!success && rateLimitResponse) return rateLimitResponse

    const token = await getToken({ req })
    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: validationError } = await validateBody(req, importSchema)
    if (validationError) return validationError

    const { folderId } = body

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // Paginate through ALL Google Docs in the folder
    type DriveFile = drive_v3.Schema$File
    const allFiles: DriveFile[] = []
    let nextPageToken: string | null | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const listResponse: drive_v3.Schema$FileList = (await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime)',
        pageSize: 100,
        pageToken: nextPageToken || undefined,
      })).data

      const files = listResponse.files || []
      allFiles.push(...files)
      nextPageToken = listResponse.nextPageToken
      hasMore = !!nextPageToken
    }

    const results = []
    const totalFiles = allFiles.length

    // Process each file
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i]
      
      // Check if already imported
      const { data: existing } = await supabase
        .from('interviews')
        .select('id')
        .eq('transcript_file_name', file.name)
        .single()

      if (existing) {
        results.push({ 
          name: file.name, 
          status: 'skipped',
          progress: { current: i + 1, total: totalFiles }
        })
        continue
      }

      try {
        // Download text
        const exportRes = await drive.files.export({
          fileId: file.id!,
          mimeType: 'text/plain',
        })
        const text = exportRes.data as string

        if (!text || text.length < 50) {
          results.push({ 
            name: file.name, 
            status: 'too_short',
            progress: { current: i + 1, total: totalFiles }
          })
          continue
        }

        // Parse transcript metadata
        const metadata = await parseTranscriptMetadata(text, file.name || '')

        // Generate Embedding
        const embedding = await generateEmbedding(text)

        // Save to Supabase
        const { error } = await supabase.from('interviews').insert({
          meeting_title: metadata.meetingType,
          meeting_date: file.createdTime || new Date().toISOString(),
          transcript: text,
          transcript_file_name: file.name,
          embedding: embedding,
          summary: metadata.summary,
          rating: 'Not Analyzed',
          candidate_name: metadata.candidateName,
          interviewer: metadata.interviewer,
          position: metadata.position || ''
        })

        if (error) {
          console.error('Supabase error:', error)
          results.push({ 
            name: file.name, 
            status: 'error',
            progress: { current: i + 1, total: totalFiles }
          })
        } else {
          results.push({ 
            name: file.name, 
            status: 'imported',
            progress: { current: i + 1, total: totalFiles }
          })
        }
      } catch (fileError) {
        console.error('File processing error:', fileError)
        results.push({ 
          name: file.name, 
          status: 'error',
          progress: { current: i + 1, total: totalFiles }
        })
      }
    }

    return NextResponse.json({ results, totalFiles })

  } catch (error) {
    return errorResponse(error, 'Import error')
  }
}
