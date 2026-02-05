export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'

import { getToken } from 'next-auth/jwt'
import { google, drive_v3 } from 'googleapis'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { z } from 'zod'

const importSchema = z.object({
  folderId: z.string()
    .min(1, 'Folder ID required')
    .max(100, 'Folder ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder ID format'),
})

export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token?.accessToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Validate input
  let folderId: string
  try {
    const body = await req.json()
    const validated = importSchema.parse(body)
    folderId = validated.folderId
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: error.issues[0]?.message || 'Invalid request' }),
        { status: 400 }
      )
    }
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false

      // Safe enqueue helper
      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          try {
            controller.enqueue(data)
          } catch (error: any) {
            if (error.code === 'ERR_INVALID_STATE') {
              isClosed = true
            } else {
              throw error
            }
          }
        }
      }

      try {
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const drive = google.drive({ version: 'v3', auth })

        // Paginate through ALL Google Docs in the folder
        type DriveFile = drive_v3.Schema$File
        const allFiles: DriveFile[] = []
        let nextPageToken: string | null | undefined = undefined
        let hasMore = true

        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'scanning', message: 'Scanning folder for files...' })}\n\n`)
        )

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

          // Update scanning progress
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'scanning', message: `Found ${allFiles.length} files...` })}\n\n`)
          )
        }

        const totalFiles = allFiles.length

        // Send total count
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'total', total: totalFiles })}\n\n`)
        )

        // Process each file
        let importedCount = 0
        let skippedCount = 0
        let errorCount = 0
        const BATCH_SIZE = 5;

        for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
          const batch = allFiles.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (file, batchIndex) => {
            const currentIndex = i + batchIndex;

            // Send progress update (throttled slightly by batch nature, but sending for each is fine for stream)
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                current: currentIndex + 1,
                total: totalFiles,
                fileName: file.name,
                imported: importedCount,
                skipped: skippedCount,
                errors: errorCount
              })}\n\n`)
            )

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

            if (existing) {
              skippedCount++
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'result',
                  name: file.name,
                  status: 'skipped',
                  reason: 'already_imported'
                })}\n\n`)
              )
              return
            }

            // Download text
            try {
              const exportRes = await drive.files.export({
                fileId: file.id!,
                mimeType: 'text/plain',
              })
              const text = exportRes.data as string

              if (!text || text.length < 50) {
                skippedCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    name: file.name,
                    status: 'too_short'
                  })}\n\n`)
                )
                return
              }

              // Parse transcript metadata
              let metadata
              try {
                metadata = await parseTranscriptMetadata(text, file.name || '')
              } catch (parseError: any) {
                console.error('Parse error for', file.name, ':', parseError.message || parseError)
                errorCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    name: file.name,
                    status: 'error',
                    reason: 'parse_failed',
                    details: parseError.message?.substring(0, 100) || 'Unknown parse error'
                  })}\n\n`)
                )
                return
              }

              // Generate Embedding
              let embedding
              try {
                embedding = await generateEmbedding(text)
              } catch (embedError: any) {
                console.error('Embedding error for', file.name, ':', embedError.message || embedError)
                errorCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    name: file.name,
                    status: 'error',
                    reason: 'embedding_failed',
                    details: embedError.message?.substring(0, 100) || 'Unknown embedding error'
                  })}\n\n`)
                )
                return
              }

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

              // Save to Supabase
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
                owner_email: token.email,
                position: metadata.position || ''
              })

              if (error) {
                console.error('Supabase error for', file.name, ':', error)
                errorCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    name: file.name,
                    status: 'error',
                    reason: 'database_failed',
                    details: error.message?.substring(0, 100) || 'Unknown database error'
                  })}\n\n`)
                )
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

                importedCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'result',
                    name: generatedTitle,
                    status: 'imported'
                  })}\n\n`)
                )
              }
            } catch (fileError: any) {
              console.error('File processing error for', file.name, ':', fileError.message || fileError)
              errorCount++
              // Provide more detail about the error
              let errorReason = 'download_failed'
              if (fileError.code === 403 || fileError.code === 404) {
                errorReason = 'access_denied'
              }
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'result',
                  name: file.name,
                  status: 'error',
                  reason: errorReason,
                  details: fileError.message?.substring(0, 100) || 'Unknown error'
                })}\n\n`)
              )
            }
          }));
        }

        // Save folder ID to user settings for future polling
        if (token.email) {
          try {
            // Get folder name
            let folderName = 'Drive Folder'
            try {
              const folderRes = await drive.files.get({
                fileId: folderId,
                fields: 'name'
              })
              folderName = folderRes.data.name || folderName
            } catch (e) {
              console.error('Failed to get folder name:', e)
            }

            const { data: existing } = await supabase
              .from('user_settings')
              .select('id')
              .eq('user_email', token.email)
              .single()

            const settingsData = {
              user_email: token.email,
              drive_folder_id: folderId,
              folder_name: folderName,
              last_poll_time: new Date().toISOString(),
              last_poll_file_count: totalFiles
            }

            if (existing) {
              await supabase
                .from('user_settings')
                .update(settingsData)
                .eq('user_email', token.email)
            } else {
              await supabase
                .from('user_settings')
                .insert(settingsData)
            }
          } catch (settingsError) {
            console.error('Failed to save folder settings:', settingsError)
          }
        }

        // Send complete signal with summary
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            summary: {
              total: totalFiles,
              imported: importedCount,
              skipped: skippedCount,
              errors: errorCount
            }
          })}\n\n`)
        )
        isClosed = true
        controller.close()
      } catch (error: any) {
        console.error('Import error:', error)
        // Sanitize error message in production
        const errorMessage = process.env.NODE_ENV === 'production'
          ? 'Import failed'
          : error.message
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`)
        )
        isClosed = true
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
