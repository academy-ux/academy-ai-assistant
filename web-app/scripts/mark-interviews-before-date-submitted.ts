/**
 * Script to mark interviews as submitted by setting submitted_at to meeting_date
 * For interviews before a specific date (Rachel Xie's meeting date)
 * Run with: npx tsx scripts/mark-interviews-before-date-submitted.ts
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

  // First find Rachel Xie's interview
  const { data: rachelData, error: rachelError } = await supabase
    .from('interviews')
    .select('*')
    .ilike('candidate_name', '%rachel%xie%')
    .single()

  if (rachelError || !rachelData) {
    console.error('❌ Rachel Xie not found:', rachelError)
    process.exit(1)
  }

  const rachelDate = rachelData.meeting_date
  console.log(`✅ Found Rachel Xie`)
  console.log(`   Meeting date: ${rachelDate}`)
  console.log(`   ID: ${rachelData.id}\n`)

  if (!rachelDate) {
    console.error('❌ Rachel Xie has no meeting date')
    process.exit(1)
  }

  // Fetch all interviews BEFORE Rachel Xie's date that don't have submitted_at set
  // Use multiple queries if needed to get past 1000 limit
  let allInterviewsBeforeRachel: any[] = []
  let pageSize = 1000
  let currentPage = 0
  let hasMore = true

  while (hasMore) {
    const from = currentPage * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .lt('meeting_date', rachelDate)  // Less than Rachel's date
      .order('meeting_date', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('❌ Error fetching interviews:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allInterviewsBeforeRachel.push(...data)
      if (data.length < pageSize) {
        hasMore = false
      } else {
        currentPage++
      }
    }
  }

  console.log(`📊 Found ${allInterviewsBeforeRachel.length} interviews before Rachel Xie\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  // Process all interviews before Rachel Xie
  for (let i = 0; i < allInterviewsBeforeRachel.length; i++) {
    const interview = allInterviewsBeforeRachel[i]
    const progress = `[${i + 1}/${allInterviewsBeforeRachel.length}]`

    try {
      const candidateName = interview.candidate_name || 'Unknown'
      const meetingDate = interview.meeting_date
      const hasSubmittedAt = Boolean(interview.submitted_at)
      const isMeetingType = interview.meeting_type === 'Interview'

      // Skip if not an interview meeting type
      if (!isMeetingType) {
        skipped++
        continue
      }

      // Skip if already submitted
      if (hasSubmittedAt) {
        skipped++
        continue
      }

      // Skip if no meeting date (shouldn't happen given our query, but safety check)
      if (!meetingDate) {
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
        console.error(`${progress} ❌ ${candidateName} - Failed: ${updateError.message}`)
        failed++
      } else {
        console.log(`${progress} ✅ ${candidateName} - Updated submitted_at to ${meetingDate}`)
        updated++
      }
    } catch (err: any) {
      console.error(`${progress} ❌ Error: ${err.message}`)
      failed++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📈 Update Complete!')
  console.log('='.repeat(60))
  console.log(`✅ Updated: ${updated}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total processed: ${allInterviewsBeforeRachel.length}`)
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
