// Direct backfill script - requires OAuth token from command line
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ACCESS_TOKEN = process.argv[2]

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

if (!ACCESS_TOKEN) {
  console.error('❌ Please provide Google OAuth access token')
  console.error('\nGet your token by visiting:')
  console.error('   https://academy-ai-assistant.vercel.app/api/debug/session')
  console.error('\nOr from DevTools while logged in:')
  console.error('   1. Open DevTools Console (F12)')
  console.error('   2. Run: await (await fetch("/api/auth/session")).json()')
  console.error('   3. Copy the accessToken value')
  console.error('\nThen run: npx tsx scripts/backfill-now.ts YOUR_ACCESS_TOKEN')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function backfill() {
  console.log('🔧 Starting Drive ID backfill...\n')

  const userEmail = 'adam.perlis@academyux.com'

  // Get Drive folder
  const { data: settings } = await supabase
    .from('user_settings')
    .select('drive_folder_id, folder_name')
    .eq('user_email', userEmail)
    .single()

  if (!settings?.drive_folder_id) {
    console.error('❌ No Drive folder configured')
    process.exit(1)
  }

  console.log(`📁 Folder: ${settings.folder_name}`)
  console.log(`🆔 ID: ${settings.drive_folder_id}\n`)

  // Fetch Drive files
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: ACCESS_TOKEN })
  const drive = google.drive({ version: 'v3', auth })

  console.log('📥 Fetching files from Google Drive...')
  const allFiles: any[] = []
  let pageToken: string | null | undefined

  try {
    do {
      const res = await drive.files.list({
        q: `'${settings.drive_folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        pageToken: pageToken || undefined,
      })
      allFiles.push(...(res.data.files || []))
      pageToken = res.data.nextPageToken
      process.stdout.write(`\r   Found ${allFiles.length} files...`)
    } while (pageToken)
    console.log(`\n✓ Total: ${allFiles.length} files\n`)
  } catch (error: any) {
    console.error('\n❌ Drive API error:', error.message)
    console.error('   Token might be expired or invalid')
    process.exit(1)
  }

  // Get records without Drive ID
  console.log('📥 Fetching database records without Drive ID...')
  const { data: interviews } = await supabase
    .from('interviews')
    .select('id, meeting_title, transcript_file_name')
    .eq('owner_email', userEmail)
    .is('drive_file_id', null)

  console.log(`✓ Found ${interviews?.length || 0} records\n`)

  // Create lookup
  const fileMap = new Map(allFiles.map(f => [f.name, f.id]))

  // Match and update
  console.log('🔗 Matching and updating records...\n')
  let matched = 0
  let updated = 0

  for (const interview of interviews || []) {
    if (!interview.transcript_file_name) continue

    const driveId = fileMap.get(interview.transcript_file_name)
    if (driveId) {
      matched++
      console.log(`✓ ${interview.meeting_title}`)
      console.log(`  → Linking to Drive ID: ${driveId}`)
      
      const { error } = await supabase
        .from('interviews')
        .update({ drive_file_id: driveId })
        .eq('id', interview.id)
      
      if (error) {
        console.log(`  ❌ Update failed: ${error.message}`)
      } else {
        updated++
      }
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Drive files: ${allFiles.length}`)
  console.log(`   Records without ID: ${interviews?.length || 0}`)
  console.log(`   ✓ Matched: ${matched}`)
  console.log(`   ✓ Updated: ${updated}`)
  console.log(`   Unmatched: ${(interviews?.length || 0) - matched}`)
  console.log('\n✅ Backfill complete!')
}

backfill().catch(error => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
