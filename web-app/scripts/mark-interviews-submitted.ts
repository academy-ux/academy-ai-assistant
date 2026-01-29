/**
 * Script to mark interviews as submitted by setting submitted_at to meeting_date
 * For interviews before Rachel Xie
 * Run with: npx tsx scripts/mark-interviews-submitted.ts
 */

import { createClient } from '@supabase/supabase-js'
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

async function markInterviewsSubmitted() {
  console.log('🚀 Starting to mark interviews as submitted...\n')

  // First, get the total count
  const { count, error: countError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Error counting interviews:', countError)
    process.exit(1)
  }

  console.log(`📊 Total interviews in database: ${count}\n`)

  // Fetch ALL interviews ordered by meeting date
  // Note: Supabase has a default limit of 1000, we need to use range() to get more
  const { data: interviews, error } = await supabase
    .from('interviews')
    .select('*')
    .order('meeting_date', { ascending: true, nullsLast: true })
    .range(0, (count || 10000) - 1)  // range is inclusive, so subtract 1

  if (error) {
    console.error('❌ Error fetching interviews:', error)
    process.exit(1)
  }

  if (!interviews || interviews.length === 0) {
    console.log('ℹ️  No interviews found')
    return
  }

  console.log(`📊 Fetched ${interviews.length} interviews for processing\n`)

  // Find Rachel Xie's interview index (case-insensitive)
  const rachelIndex = interviews.findIndex(
    i => i.candidate_name?.toLowerCase().trim() === 'rachel xie'
  )

  if (rachelIndex === -1) {
    console.log('⚠️  Rachel Xie not found. Showing all candidates:')
    interviews.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.candidate_name || 'Unknown'} - ${i.meeting_date || 'No date'}`)
    })
    console.log('\nPlease verify the candidate name and try again.')
    return
  }

  console.log(`✅ Found Rachel Xie at position ${rachelIndex + 1}`)
  console.log(`   Meeting date: ${interviews[rachelIndex].meeting_date || 'No date'}`)
  console.log(`\n📋 Interviews BEFORE Rachel Xie (${rachelIndex} total):\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  // Process all interviews before Rachel Xie
  for (let i = 0; i < rachelIndex; i++) {
    const interview = interviews[i]
    const progress = `[${i + 1}/${rachelIndex}]`

    try {
      const candidateName = interview.candidate_name || 'Unknown'
      const meetingDate = interview.meeting_date
      const hasSubmittedAt = Boolean(interview.submitted_at)

      console.log(`${progress} ${candidateName}`)
      console.log(`   Meeting date: ${meetingDate || 'No date'}`)
      console.log(`   Current submitted_at: ${interview.submitted_at || 'null'}`)

      // Skip if no meeting date
      if (!meetingDate) {
        console.log(`   ⏭️  Skipping - no meeting_date available`)
        skipped++
        continue
      }

      // Skip if already submitted
      if (hasSubmittedAt) {
        console.log(`   ⏭️  Skipping - already has submitted_at`)
        skipped++
        continue
      }

      // Update submitted_at to meeting_date
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          submitted_at: meetingDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', interview.id)

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`)
        failed++
      } else {
        console.log(`   ✅ Updated submitted_at to ${meetingDate}`)
        updated++
      }
    } catch (err: any) {
      console.error(`${progress} ❌ Error: ${err.message}`)
      failed++
    }

    console.log('') // blank line between entries
  }

  console.log('='.repeat(60))
  console.log('📈 Update Complete!')
  console.log('='.repeat(60))
  console.log(`✅ Updated: ${updated}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total processed: ${rachelIndex}`)
}

// Run the script
markInterviewsSubmitted()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  })
