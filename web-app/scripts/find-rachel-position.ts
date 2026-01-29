import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function findRachelPosition() {
  // Get all interviews
  const { data: allInterviews, error } = await supabase
    .from('interviews')
    .select('id, candidate_name, meeting_date, created_at')
    .order('meeting_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Total interviews: ${allInterviews?.length}`)
  
  // Find Rachel Xie (case-insensitive)
  const rachelIndex = allInterviews?.findIndex(
    i => i.candidate_name?.toLowerCase().trim() === 'rachel xie'
  )

  if (rachelIndex === undefined || rachelIndex === -1) {
    console.log('\nRachel Xie not found in sorted list')
    
    // Try to find her with any case
    const rachelAny = allInterviews?.find(
      i => i.candidate_name?.toLowerCase().includes('rachel') && i.candidate_name?.toLowerCase().includes('xie')
    )
    
    if (rachelAny) {
      console.log('Found Rachel with name:', rachelAny.candidate_name)
      console.log('Meeting date:', rachelAny.meeting_date)
      console.log('Created at:', rachelAny.created_at)
      
      const index = allInterviews?.indexOf(rachelAny)
      console.log('Position in sorted list:', index)
    }
    return
  }

  const rachel = allInterviews[rachelIndex]
  console.log(`\n✅ Found Rachel Xie at position ${rachelIndex + 1}`)
  console.log(`   Candidate name: "${rachel.candidate_name}"`)
  console.log(`   Meeting date: ${rachel.meeting_date}`)
  console.log(`   Created at: ${rachel.created_at}`)
  
  // Show 5 interviews before and after
  console.log('\n--- 5 interviews before Rachel Xie:')
  for (let i = Math.max(0, rachelIndex - 5); i < rachelIndex; i++) {
    const interview = allInterviews[i]
    console.log(`  ${i + 1}. ${interview.candidate_name} | ${interview.meeting_date}`)
  }
  
  console.log(`\n>>> ${rachelIndex + 1}. ${rachel.candidate_name} | ${rachel.meeting_date} <<<`)
  
  console.log('\n--- 5 interviews after Rachel Xie:')
  for (let i = rachelIndex + 1; i < Math.min(allInterviews.length, rachelIndex + 6); i++) {
    const interview = allInterviews[i]
    console.log(`  ${i + 1}. ${interview.candidate_name} | ${interview.meeting_date}`)
  }
  
  console.log(`\n📊 Total interviews before Rachel Xie: ${rachelIndex}`)
}

findRachelPosition()
