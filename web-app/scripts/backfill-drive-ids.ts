// This script matches existing database records to Drive files by filename
// and updates the drive_file_id field for records that don't have it

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

// You'll need to provide an OAuth access token as a command line argument
const ACCESS_TOKEN = process.argv[2]

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

if (!ACCESS_TOKEN) {
  console.error('❌ Usage: npx tsx scripts/backfill-drive-ids.ts <google-oauth-token>')
  console.error('   Get your token from: https://academy-ai-assistant.vercel.app/api/debug/session')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function backfillDriveIds() {
  console.log('🔧 Backfilling Drive File IDs...\n')

  const userEmail = 'adam.perlis@academyux.com'

  // Get Drive folder ID
  const { data: settings } = await supabase
    .from('user_settings')
    .select('drive_folder_id, folder_name')
    .eq('user_email', userEmail)
    .single()

  if (!settings?.drive_folder_id) {
    console.error('❌ No Drive folder configured')
    process.exit(1)
  }

  console.log(`📁 Folder: ${settings.folder_name}\n`)

  // Fetch all Drive files
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: ACCESS_TOKEN })
  const drive = google.drive({ version: 'v3', auth })

  console.log('📥 Fetching files from Google Drive...')
  
  const allDriveFiles: any[] = []
  let nextPageToken: string | null | undefined = undefined

  try {
    do {
      const response = await drive.files.list({
        q: `'${settings.drive_folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
        pageSize: 100,
        pageToken: nextPageToken || undefined,
      })

      allDriveFiles.push(...(response.data.files || []))
      nextPageToken = response.data.nextPageToken
      
      process.stdout.write(`\r   Found ${allDriveFiles.length} files...`)
    } while (nextPageToken)

    console.log(`\n✓ Found ${allDriveFiles.length} files in Drive\n`)
  } catch (error: any) {
    console.error('❌ Failed to fetch Drive files:', error.message)
    process.exit(1)
  }

  // Fetch database records without drive_file_id
  console.log('📥 Fetching database records without Drive ID...')
  const { data: interviews, error } = await supabase
    .from('interviews')
    .select('id, meeting_title, transcript_file_name, drive_file_id, meeting_date')
    .eq('owner_email', userEmail)
    .is('drive_file_id', null)

  if (error) {
    console.error('❌ Database error:', error.message)
    process.exit(1)
  }

  console.log(`✓ Found ${interviews?.length || 0} records without Drive ID\n`)

  // Create lookup map for Drive files by name
  const driveFilesByName = new Map(
    allDriveFiles.map(f => [f.name, f])
  )

  // Match and update
  console.log('🔗 Matching records to Drive files...\n')
  
  let matched = 0
  let updated = 0
  let failed = 0

  for (const interview of interviews || []) {
    if (!interview.transcript_file_name) continue

    const driveFile = driveFilesByName.get(interview.transcript_file_name)
    
    if (driveFile) {
      matched++
      console.log(`✓ Match: ${interview.meeting_title}`)
      console.log(`  File: ${interview.transcript_file_name}`)
      console.log(`  Drive ID: ${driveFile.id}`)
      
      // Update the record
      const { error: updateError } = await supabase
        .from('interviews')
        .update({ drive_file_id: driveFile.id })
        .eq('id', interview.id)
      
      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`)
        failed++
      } else {
        console.log(`  ✓ Updated`)
        updated++
      }
      console.log()
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Total Drive files: ${allDriveFiles.length}`)
  console.log(`   Records without Drive ID: ${interviews?.length || 0}`)
  console.log(`   ✓ Matched: ${matched}`)
  console.log(`   ✓ Updated: ${updated}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   Unmatched: ${(interviews?.length || 0) - matched}`)
}

backfillDriveIds().catch(console.error)
