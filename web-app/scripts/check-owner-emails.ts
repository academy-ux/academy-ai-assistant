/**
 * Script to check owner_email values in the database
 * Run with: npx tsx scripts/check-owner-emails.ts
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

async function checkOwnerEmails() {
  console.log('🔍 Checking owner_email values in database...\n')

  // Get total count
  const { count: totalCount, error: totalError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })

  if (totalError) {
    console.error('❌ Error counting interviews:', totalError)
    process.exit(1)
  }

  console.log(`📊 Total meetings: ${totalCount}\n`)

  // Count NULL owner_email
  const { count: nullCount, error: nullError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })
    .is('owner_email', null)

  if (nullError) {
    console.error('❌ Error counting NULL owner_email:', nullError)
    process.exit(1)
  }

  console.log(`📊 Meetings with NULL owner_email: ${nullCount}`)

  // Get unique owner_email values
  const { data, error } = await supabase
    .from('interviews')
    .select('owner_email')
    .order('owner_email', { ascending: true })

  if (error) {
    console.error('❌ Error fetching owner_emails:', error)
    process.exit(1)
  }

  // Count occurrences of each owner_email
  const emailCounts: Record<string, number> = {}
  data?.forEach((item) => {
    const email = item.owner_email || '(NULL)'
    emailCounts[email] = (emailCounts[email] || 0) + 1
  })

  console.log('\n📧 Owner email distribution:')
  console.log('='.repeat(60))
  Object.entries(emailCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([email, count]) => {
      console.log(`${email.padEnd(40)} ${count} meetings`)
    })
  console.log('='.repeat(60))

  // Show sample meetings
  console.log('\n📋 Sample meetings (first 10):')
  const { data: samples, error: sampleError } = await supabase
    .from('interviews')
    .select('id, candidate_name, owner_email, meeting_date')
    .order('meeting_date', { ascending: false })
    .limit(10)

  if (sampleError) {
    console.error('❌ Error fetching samples:', sampleError)
  } else {
    samples?.forEach((meeting, idx) => {
      console.log(`${idx + 1}. ${meeting.candidate_name || 'Unknown'} - owner: ${meeting.owner_email || '(NULL)'} - ${meeting.meeting_date || 'No date'}`)
    })
  }
}

// Run the script
checkOwnerEmails()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  })
