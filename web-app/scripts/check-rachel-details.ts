import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function checkRachelDetails() {
  // Count total interviews
  const { count, error: countError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Error counting:', countError)
    return
  }

  console.log(`Total interviews in database: ${count}`)

  // Find Rachel Xie specifically
  const { data: rachels, error } = await supabase
    .from('interviews')
    .select('*')
    .ilike('candidate_name', '%rachel%xie%')

  if (error) {
    console.error('Error finding Rachel:', error)
    return
  }

  if (!rachels || rachels.length === 0) {
    console.log('\nNo Rachel Xie found')
    return
  }

  console.log(`\nFound ${rachels.length} Rachel Xie interview(s):\n`)
  
  for (const rachel of rachels) {
    console.log('Candidate name:', rachel.candidate_name)
    console.log('Meeting date:', rachel.meeting_date)
    console.log('Created at:', rachel.created_at)
    console.log('Submitted at:', rachel.submitted_at)
    console.log('ID:', rachel.id)
    console.log('Meeting title:', rachel.meeting_title)
    console.log('---')
  }
}

checkRachelDetails()
