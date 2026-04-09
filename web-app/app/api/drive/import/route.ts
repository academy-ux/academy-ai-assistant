export const dynamic = 'force-dynamic'
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

      // Check if already imported (by Drive file ID first, then by file name)
      let existing = null

      // First check by Drive file ID (most reliable)
      if (file.id) {
        const { data: existingById } = await supabase
          .from('interviews')
          .select('id')
          .eq('drive_file_id', file.id)
          .maybeSingle()
        existing = existingById
      }

      // If not found by ID, check by file name (for backwards compatibility)
      if (!existing && file.name) {
        const { data: existingByName } = await supabase
          .from('interviews')
          .select('id')
          .eq('transcript_file_name', file.name)
          .maybeSingle()
        existing = existingByName
      }

      // Cross-pathway check: match against Chrome extension uploads (meet-*) on the same day
      // so we don't end up with one row from the extension + another from Drive for the same meeting.
      if (!existing && file.createdTime) {
        const fileDate = new Date(file.createdTime)
        const startOfDay = new Date(fileDate); startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(fileDate); endOfDay.setHours(23, 59, 59, 999)

        const { data: extensionCandidates } = await supabase
          .from('interviews')
          .select('id, transcript')
          .eq('owner_email', userEmail)
          .like('drive_file_id', 'meet-%')
          .gte('meeting_date', startOfDay.toISOString())
          .lte('meeting_date', endOfDay.toISOString())

        if (extensionCandidates && extensionCandidates.length > 0) {
          try {
            const previewRes = await drive.files.export({ fileId: file.id!, mimeType: 'text/plain' })
            const previewText = (previewRes.data as string)?.substring(0, 500) || ''
            const previewWords = previewText.split(/\s+/).filter(Boolean)

            for (const candidate of extensionCandidates) {
              const existingSnippet = (candidate.transcript || '').substring(0, 500)
              if (!existingSnippet || previewWords.length === 0) continue
              const overlap = previewWords.filter((w: string) => existingSnippet.includes(w)).length
              if (overlap / previewWords.length > 0.6) {
                // Same transcript — re-link the existing extension row to this Drive file
                await supabase
                  .from('interviews')
                  .update({ drive_file_id: file.id })
                  .eq('id', candidate.id)
                existing = { id: candidate.id }
                break
              }
            }
          } catch (previewError) {
            console.error('[Import] Preview comparison failed:', previewError)
          }
        }
      }

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

        // Upsert on drive_file_id so concurrent imports can't race and create duplicates
        const { error } = await supabase.from('interviews').upsert(
          {
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
          },
          { onConflict: 'drive_file_id', ignoreDuplicates: true }
        )

        if (error) {
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
