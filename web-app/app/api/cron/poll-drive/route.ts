import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { google, drive_v3 } from 'googleapis'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'

// This endpoint should be called by Vercel Cron or can be manually triggered
// Vercel Cron requires CRON_SECRET for security
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (only in production)
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('[Cron] Starting Drive folder polling...')

    // Get all users with auto-polling enabled
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('auto_poll_enabled', true)
      .not('drive_folder_id', 'is', null)

    if (usersError) throw usersError

    if (!users || users.length === 0) {
      console.log('[Cron] No users with auto-polling enabled')
      return NextResponse.json({ 
        success: true, 
        message: 'No users to poll',
        polledUsers: 0 
      })
    }

    console.log(`[Cron] Found ${users.length} users to poll`)

    const results = []

    for (const user of users) {
      try {
        // Check if enough time has passed since last poll
        if (user.last_poll_time) {
          const timeSinceLastPoll = Date.now() - new Date(user.last_poll_time).getTime()
          const intervalMs = user.poll_interval_minutes * 60 * 1000
          
          if (timeSinceLastPoll < intervalMs) {
            console.log(`[Cron] Skipping ${user.user_email} - too soon since last poll`)
            continue
          }
        }

        console.log(`[Cron] Polling folder for ${user.user_email}`)

        // We need to get the user's access token
        // Since we don't have it in the cron job, we'll skip OAuth-dependent operations
        // This is a limitation - polling requires user's access token
        
        // For now, we'll update the last_poll_time to show we attempted
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({ 
            last_poll_time: new Date().toISOString(),
          })
          .eq('user_email', user.user_email)

        if (updateError) throw updateError

        results.push({
          email: user.user_email,
          status: 'attempted',
          message: 'Polling requires user OAuth token - use manual import'
        })

      } catch (userError: any) {
        console.error(`[Cron] Error polling for ${user.user_email}:`, userError)
        results.push({
          email: user.user_email,
          status: 'error',
          error: userError.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      polledUsers: users.length,
      results
    })

  } catch (error: any) {
    console.error('[Cron] Poll error:', error)
    return NextResponse.json({ 
      error: 'Polling failed',
      message: error.message 
    }, { status: 500 })
  }
}

// Helper function to poll a single folder (for manual triggers with auth)
export async function pollFolder(
  accessToken: string,
  folderId: string,
  userEmail: string
): Promise<{ imported: number; skipped: number; errors: number }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  // Get all files in folder
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

  let imported = 0
  let skipped = 0
  let errors = 0

  // Process files in batches
  const BATCH_SIZE = 5
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE)
    
    await Promise.all(batch.map(async (file) => {
      try {
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
          skipped++
          return
        }

        // Download and process
        const exportRes = await drive.files.export({
          fileId: file.id!,
          mimeType: 'text/plain',
        })
        const text = exportRes.data as string

        if (!text || text.length < 50) {
          skipped++
          return
        }

        const metadata = await parseTranscriptMetadata(text, file.name || '')
        const embedding = await generateEmbedding(text)

        const { error } = await supabase.from('interviews').insert({
          meeting_title: metadata.meetingType,
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
          position: metadata.position || ''
        })

        if (error) {
          console.error('Insert error:', error)
          errors++
        } else {
          imported++
        }
      } catch (fileError) {
        console.error('File processing error:', fileError)
        errors++
      }
    }))
  }

  // Update settings with poll results
  await supabase
    .from('user_settings')
    .update({ 
      last_poll_time: new Date().toISOString(),
      last_poll_file_count: allFiles.length
    })
    .eq('user_email', userEmail)

  return { imported, skipped, errors }
}
