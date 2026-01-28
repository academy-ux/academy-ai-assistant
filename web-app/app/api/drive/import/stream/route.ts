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

            // Check if already imported
            const { data: existing } = await supabase
              .from('interviews')
              .select('id')
              .eq('transcript_file_name', file.name)
              .single()

            if (existing) {
              skippedCount++
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'result',
                  name: file.name, 
                  status: 'skipped'
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
              const metadata = await parseTranscriptMetadata(text, file.name || '')

              // Generate Embedding
              const embedding = await generateEmbedding(text)

              // Save to Supabase
              const { error } = await supabase.from('interviews').insert({
                meeting_title: metadata.meetingType,
                meeting_type: metadata.meetingCategory,
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
                errorCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'result',
                    name: file.name, 
                    status: 'error'
                  })}\n\n`)
                )
              } else {
                importedCount++
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    type: 'result',
                    name: file.name, 
                    status: 'imported'
                  })}\n\n`)
                )
              }
            } catch (fileError: any) {
              console.error('File processing error:', fileError)
              errorCount++
              safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'result',
                  name: file.name, 
                  status: 'error'
                })}\n\n`)
              )
            }
          }));
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
