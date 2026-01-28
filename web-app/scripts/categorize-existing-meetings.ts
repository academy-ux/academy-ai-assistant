/**
 * Script to categorize all existing meetings in the database
 * Run with: npx tsx scripts/categorize-existing-meetings.ts
 */

import { createClient } from '@supabase/supabase-js'
import { parseTranscriptMetadata } from '../lib/transcript-parser'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function categorizeMeetings() {
  console.log('🚀 Starting meeting categorization...\n')

  // Fetch all meetings
  const { data: meetings, error } = await supabase
    .from('interviews')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching meetings:', error)
    process.exit(1)
  }

  if (!meetings || meetings.length === 0) {
    console.log('ℹ️  No meetings found to categorize')
    return
  }

  console.log(`📊 Found ${meetings.length} meetings to categorize\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i]
    const progress = `[${i + 1}/${meetings.length}]`
    
    try {
      // Skip if already has meeting_type
      if (meeting.meeting_type) {
        console.log(`${progress} ⏭️  Skipping "${meeting.transcript_file_name}" - already categorized as "${meeting.meeting_type}"`)
        skipped++
        continue
      }

      console.log(`${progress} 🔄 Processing "${meeting.transcript_file_name}"...`)

      // Parse metadata to get category
      const metadata = await parseTranscriptMetadata(
        meeting.transcript,
        meeting.transcript_file_name || 'unknown'
      )

      // Update the meeting with category
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          candidate_name: metadata.candidateName,
          interviewer: metadata.interviewer,
          meeting_title: metadata.meetingType,
          meeting_type: metadata.meetingCategory,
          summary: metadata.summary,
          position: metadata.position || meeting.position,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id)

      if (updateError) {
        console.error(`${progress} ❌ Failed to update: ${updateError.message}`)
        failed++
      } else {
        console.log(`${progress} ✅ Categorized as "${metadata.meetingCategory}"`)
        updated++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err: any) {
      console.error(`${progress} ❌ Error: ${err.message}`)
      failed++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📈 Categorization Complete!')
  console.log('='.repeat(50))
  console.log(`✅ Updated: ${updated}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total: ${meetings.length}`)
}

// Run the script
categorizeMeetings()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  })
