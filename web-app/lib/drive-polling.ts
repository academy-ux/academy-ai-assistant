import { supabase } from '@/lib/supabase'
import { google, drive_v3 } from 'googleapis'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { findExistingImport, titleAlreadyImported, UNIQUE_VIOLATION } from '@/lib/import-dedup'

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
 * Import a single Drive doc as an interview. Used by pollFolder for each file,
 * and directly by one-off backfills that target specific file IDs.
 */
export async function importDriveFile(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  userEmail: string
): Promise<'imported' | 'skipped' | 'error'> {
  try {
    const existing = await findExistingImport(drive, file, userEmail)

    if (existing) {
      console.log(`[Poll] Skipping already imported: ${file.name}`)
      return 'skipped'
    }

    console.log(`[Poll] Processing new file: ${file.name}`)
    
    // Download and process
    const exportRes = await drive.files.export({
      fileId: file.id!,
      mimeType: 'text/plain',
    })
    const text = exportRes.data as string

    if (!text || text.length < 50) {
      console.log(`[Poll] Skipping (too short): ${file.name}`)
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

    // Final dedup check: same generated title + owner = Tactiq vs Google native duplicate
    if (await titleAlreadyImported(generatedTitle, userEmail)) {
      console.log(`[Poll] Skipping duplicate title: ${generatedTitle}`)
      return 'skipped'
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
      // Another poll/import inserted this file first — not an error
      console.log(`[Poll] Skipping (imported concurrently): ${file.name}`)
      return 'skipped'
    }
    if (error) {
      console.error(`[Poll] ❌ Insert error for "${file.name}":`, error)
      console.error(`[Poll] Failed data: meetingType="${metadata.meetingCategory}", candidateName="${metadata.candidateName}"`)
      return 'error'
    } else {
      console.log(`[Poll] ✅ Successfully imported: ${generatedTitle}`)
      
      // Rename the file in Google Drive to use the intelligent title
      try {
        await drive.files.update({
          fileId: file.id!,
          requestBody: {
            name: generatedTitle
          }
        })
        console.log(`[Poll] Renamed Drive file: "${file.name}" -> "${generatedTitle}"`)
      } catch (renameError: any) {
        // Log but don't fail the import if rename fails
        console.error('[Poll] Failed to rename Drive file:', file.name, renameError.message || renameError)
      }
      
      return 'imported'
    }
  } catch (fileError) {
    console.error('File processing error:', fileError)
    return 'error'
  }
}

/**
 * Helper function to poll a single Drive folder for new transcripts
 * Used by both the cron job and manual polling endpoints
 * 
 * @param fastMode - If true, only checks files from the past 48 hours (max 30 files) for faster polling
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
  
  // In fast mode, only look at files from the past 48 hours (regardless of last poll time)
  if (fastMode) {
    const twoDaysAgo = new Date()
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48)
    query += ` and modifiedTime > '${twoDaysAgo.toISOString()}'`
    console.log(`[Poll] Fast mode: checking files modified since ${twoDaysAgo.toISOString()}`)
  } else {
    console.log(`[Poll] Full sync mode: checking ALL files`)
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
    
    console.log(`[Poll] Found ${files.length} files in this page (total so far: ${allFiles.length})`)
    if (files.length > 0) {
      console.log(`[Poll] Sample files:`, files.slice(0, 3).map(f => ({ name: f.name, modified: f.modifiedTime })))
    }
    
    nextPageToken = listResponse.nextPageToken
    hasMore = !!nextPageToken && filesChecked < maxFilesToCheck
    
    // In fast mode, if we're getting no results, stop early
    if (fastMode && files.length === 0) {
      break
    }
  }

  // Dedupe files by id — the same file can appear under multiple parents (shortcuts),
  // and when we OR across subfolder queries a single file may be returned multiple times.
  // Without this, parallel processing of the same file.id inside a BATCH races and inserts duplicates.
  const seenFileIds = new Set<string>()
  const uniqueFiles: DriveFile[] = []
  for (const file of allFiles) {
    if (!file.id || seenFileIds.has(file.id)) continue
    seenFileIds.add(file.id)
    uniqueFiles.push(file)
  }
  if (uniqueFiles.length !== allFiles.length) {
    console.log(`[Poll] Deduped files: ${allFiles.length} -> ${uniqueFiles.length}`)
  }
  allFiles.length = 0
  allFiles.push(...uniqueFiles)

  console.log(`[Poll] Total files to process: ${allFiles.length}`)

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
    const batchResults = await Promise.all(batch.map((file) => importDriveFile(drive, file, userEmail)))
    
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

  console.log(`[Poll] ========== RESULTS ==========`)
  console.log(`[Poll] Total files checked: ${allFiles.length}`)
  console.log(`[Poll] ✅ Imported: ${imported}`)
  console.log(`[Poll] ⏭️  Skipped: ${skipped}`)
  console.log(`[Poll] ❌ Errors: ${errors}`)
  console.log(`[Poll] ================================`)

  return { imported, skipped, errors }
}
