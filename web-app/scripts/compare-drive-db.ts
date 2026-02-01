import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function compareDriveAndDatabase() {
  console.log('🔍 Comparing Google Drive folder with database...\n')

  // Get user email from command line or use default
  const userEmail = process.argv[2] || 'adam.perlis@academyux.com'
  console.log(`📧 Checking for user: ${userEmail}\n`)

  // Get user's Drive folder from settings
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('drive_folder_id, folder_name')
    .eq('user_email', userEmail)
    .single()

  if (settingsError || !settings?.drive_folder_id) {
    console.error('❌ No Drive folder configured for this user')
    console.error('Please configure your Drive folder in the app first')
    process.exit(1)
  }

  console.log(`📁 Drive Folder: ${settings.folder_name}`)
  console.log(`🆔 Folder ID: ${settings.drive_folder_id}\n`)

  // Note: We can't access Drive without OAuth token
  console.log('⚠️  Cannot access Google Drive without user OAuth token')
  console.log('This script can only check the database side.\n')

  // Fetch all interviews from database for this user
  const { data: dbInterviews, error: dbError } = await supabase
    .from('interviews')
    .select('id, meeting_title, transcript_file_name, drive_file_id, meeting_date, owner_email')
    .eq('owner_email', userEmail)
    .order('meeting_date', { ascending: false })

  if (dbError) {
    console.error('❌ Database error:', dbError.message)
    process.exit(1)
  }

  console.log('📊 Database Summary:')
  console.log(`   Total interviews: ${dbInterviews?.length || 0}`)
  console.log(`   With Drive ID: ${dbInterviews?.filter(i => i.drive_file_id).length || 0}`)
  console.log(`   Without Drive ID: ${dbInterviews?.filter(i => !i.drive_file_id).length || 0}\n`)

  // Show most recent 20
  console.log('📝 Most Recent 20 Interviews in Database:\n')
  const recent = dbInterviews?.slice(0, 20) || []
  recent.forEach((interview, i) => {
    const date = new Date(interview.meeting_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const driveIdStatus = interview.drive_file_id ? '✓' : '✗'
    console.log(`${i + 1}. [${driveIdStatus}] ${interview.meeting_title}`)
    console.log(`   Date: ${date}`)
    if (interview.drive_file_id) {
      console.log(`   Drive ID: ${interview.drive_file_id}`)
    }
    if (interview.transcript_file_name) {
      console.log(`   File: ${interview.transcript_file_name}`)
    }
    console.log()
  })

  console.log('\n💡 To get Drive folder contents, use the web app:')
  console.log('   Settings → Drive Sync Diagnostic → Check Drive vs Database')
  console.log('\n   Or run a manual import to sync missing files.')
}

compareDriveAndDatabase().catch(console.error)
