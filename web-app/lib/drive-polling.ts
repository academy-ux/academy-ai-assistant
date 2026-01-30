import { supabase } from '@/lib/supabase'
import { google, drive_v3 } from 'googleapis'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'

/**
 * Helper to get all subfolder IDs recursively (up to 2 levels deep to avoid performance issues)
 */
async function getSubfolderIds(
  drive: drive_v3.Drive,
  folderId: string,
  depth: number = 0,
  maxDepth: number = 2
): Promise<string[]> {
  if (depth >= maxDepth) return []
  
  const folderIds: string[] = [folderId]
  
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 100
    })
    
    const subfolders = response.data.files || []
    
    for (const subfolder of subfolders) {
      if (subfolder.id) {
        folderIds.push(subfolder.id)
        // Recursively get subfolders of this subfolder
        const nestedIds = await getSubfolderIds(drive, subfolder.id, depth + 1, maxDepth)
        folderIds.push(...nestedIds)
      }
    }
  } catch (error) {
    console.error('Error fetching subfolders:', error)
  }
  
  return folderIds
}

/**
 * Helper function to poll a single Drive folder for new transcripts
 * Used by both the cron job and manual polling endpoints
 * 
 * @param fastMode - If true, only checks the 30 most recent files for faster polling
 * @param includeSubfolders - If true, searches in subfolders recursively (up to 2 levels deep)
 */
export async function pollFolder(
  accessToken: string,
  folderId: string,
  userEmail: string,
  fastMode: boolean = true,
  includeSubfolders: boolean = true
): Promise<{ imported: number; skipped: number; errors: number }> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  // Get user's last poll time to optimize queries
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('last_poll_time')
    .eq('user_email', userEmail)
    .maybeSingle()

  const lastPollTime = userSettings?.last_poll_time

  // Get all folder IDs to search (including subfolders if enabled)
  const folderIds = includeSubfolders 
    ? await getSubfolderIds(drive, folderId)
    : [folderId]
  
  console.log(`[Poll] Searching in ${folderIds.length} folder(s) (includeSubfolders: ${includeSubfolders})`)

  // Build query - search across all folders
  const folderQuery = folderIds.length === 1
    ? `'${folderIds[0]}' in parents`
    : `(${folderIds.map(id => `'${id}' in parents`).join(' or ')})`
  
  let query = `${folderQuery} and mimeType = 'application/vnd.google-apps.document' and trashed = false`
  
  // If we have a last poll time, only look for files modified after that
  if (fastMode && lastPollTime) {
    const lastPollDate = new Date(lastPollTime)
    // Go back 5 minutes before last poll to account for any timing issues
    lastPollDate.setMinutes(lastPollDate.getMinutes() - 5)
    query += ` and modifiedTime > '${lastPollDate.toISOString()}'`
  }

  // Get files in folder, ordered by modified time (most recent first)
  type DriveFile = drive_v3.Schema$File
  const allFiles: DriveFile[] = []
  let nextPageToken: string | null | undefined = undefined
  let hasMore = true
  
  // In fast mode, limit to checking only the most recent 30 files
  const maxFilesToCheck = fastMode ? 30 : Infinity
  let filesChecked = 0

  while (hasMore && filesChecked < maxFilesToCheck) {
    const pageSize = fastMode ? Math.min(30, maxFilesToCheck - filesChecked) : 100
    
    const listResponse: drive_v3.Schema$FileList = (await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
      pageSize: pageSize,
      orderBy: 'modifiedTime desc', // Most recent files first
      pageToken: nextPageToken || undefined,
    })).data

    const files = listResponse.files || []
    allFiles.push(...files)
    filesChecked += files.length
    
    nextPageToken = listResponse.nextPageToken
    hasMore = !!nextPageToken && filesChecked < maxFilesToCheck
    
    // In fast mode, if we're getting no results, stop early
    if (fastMode && files.length === 0) {
      break
    }
  }

  let imported = 0
  let skipped = 0
  let errors = 0
  let consecutiveSkipped = 0

  // Process files in batches
  const BATCH_SIZE = 5
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    // In fast mode, stop early if we've seen 10 consecutive files that are already imported
    // This means we've reached the point where we've already processed everything new
    if (fastMode && consecutiveSkipped >= 10) {
      console.log(`[Poll] Early stop: ${consecutiveSkipped} consecutive files already imported`)
      break
    }
    
    const batch = allFiles.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(async (file) => {
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
          return 'skipped'
        }

        // Download and process
        const exportRes = await drive.files.export({
          fileId: file.id!,
          mimeType: 'text/plain',
        })
        const text = exportRes.data as string

        if (!text || text.length < 50) {
          return 'skipped'
        }

        const metadata = await parseTranscriptMetadata(text, file.name || '')
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
          position: metadata.position || ''
        })

        if (error) {
          console.error('Insert error:', error)
          return 'error'
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
          
          return 'imported'
        }
      } catch (fileError) {
        console.error('File processing error:', fileError)
        return 'error'
      }
    }))
    
    // Process batch results and update counters
    let batchHasImported = false
    for (const result of batchResults) {
      if (result === 'imported') {
        imported++
        batchHasImported = true
      } else if (result === 'skipped') {
        skipped++
      } else if (result === 'error') {
        errors++
      }
    }
    
    // Track consecutive skipped files for early stopping
    if (batchHasImported) {
      consecutiveSkipped = 0
    } else {
      consecutiveSkipped += batchResults.filter(r => r === 'skipped').length
    }
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
