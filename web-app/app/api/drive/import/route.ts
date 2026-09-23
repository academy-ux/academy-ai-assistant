export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

import { getToken } from 'next-auth/jwt'
import { google, drive_v3 } from 'googleapis'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { findExistingImport, UNIQUE_VIOLATION } from '@/lib/import-dedup'
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
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userEmail = token.email as string

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

    // Dedupe Drive files by id — the same file can appear in multiple parents (shortcuts/subfolders)
    const seenFileIds = new Set<string>()
    const uniqueFiles: DriveFile[] = []
    for (const file of allFiles) {
      if (!file.id || seenFileIds.has(file.id)) continue
      seenFileIds.add(file.id)
      uniqueFiles.push(file)
    }
    allFiles.length = 0
    allFiles.push(...uniqueFiles)

    const results = []
    const totalFiles = allFiles.length

    // Process each file
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i]

      const existing = await findExistingImport(drive, file, userEmail)

      if (existing) {
        results.push({
          name: file.name,
          status: 'skipped',
          reason: 'already_imported',
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

        // Generate a descriptive meeting title
        const meetingDate = file.createdTime
          ? new Date(file.createdTime).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

        let generatedTitle = metadata.meetingType || 'Meeting'

        // Format: "Candidate <> Interviewer — Type MM/DD/YYYY"
        if (metadata.candidateName && metadata.candidateName !== 'Unknown Candidate' && metadata.candidateName !== 'Team') {
          if (metadata.interviewer && metadata.interviewer !== 'Unknown') {
            generatedTitle = `${metadata.candidateName} <> ${metadata.interviewer} — ${metadata.meetingCategory} ${meetingDate}`
          } else {
            generatedTitle = `${metadata.candidateName} — ${metadata.meetingCategory} ${meetingDate}`
          }
        } else if (metadata.meetingCategory && metadata.meetingCategory !== 'Other') {
          generatedTitle = `${metadata.meetingCategory} ${meetingDate}`
        }

        const { error } = await supabase.from('interviews').insert({
          meeting_title: generatedTitle,
          meeting_type: metadata.meetingCategory,
          meeting_date: file.createdTime || new Date().toISOString(),
          transcript: text,
          transcript_file_name: file.name,
          drive_file_id: file.id,
          embedding: embedding,
          summary: metadata.summary,
          rating: 'Not Analyzed',
          candidate_name: metadata.candidateName,
          interviewer: metadata.interviewer,
          position: metadata.position || '',
          owner_email: userEmail
        })

        if (error?.code === UNIQUE_VIOLATION) {
          // Imported concurrently by the cron poller — not an error
          results.push({
            name: file.name,
            status: 'skipped',
            reason: 'already_imported',
            progress: { current: i + 1, total: totalFiles }
          })
        } else if (error) {
          console.error('Supabase error:', error)
          results.push({
            name: file.name,
            status: 'error',
            progress: { current: i + 1, total: totalFiles }
          })
        } else {
          // Rename the file in Google Drive to use the intelligent title
          try {
            await drive.files.update({
              fileId: file.id!,
              requestBody: {
                name: generatedTitle
              }
            })
            console.log(`Renamed Drive file: "${file.name}" -> "${generatedTitle}"`)
          } catch (renameError: any) {
            // Log but don't fail the import if rename fails
            console.error('Failed to rename Drive file:', file.name, renameError.message || renameError)
          }

          results.push({
            name: generatedTitle,
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
