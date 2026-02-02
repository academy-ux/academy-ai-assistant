import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkFile() {
  console.log('🔍 Searching for "Superhuman<>AcademyUX Sync"...\n')
  
  // Search by exact filename
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('transcript_file_name', 'Superhuman<>AcademyUX Sync')
    .single()

  if (error) {
    console.log('❌ Not found by exact filename')
    
    // Try searching by partial match
    const { data: byTitle } = await supabase
      .from('interviews')
      .select('*')
      .or('meeting_title.ilike.%Superhuman%,transcript_file_name.ilike.%Superhuman%')
      .limit(5)
    
    if (byTitle && byTitle.length > 0) {
      console.log('\n✓ Found by search:')
      byTitle.forEach((interview: any) => {
        console.log(`\n  📄 Title: ${interview.meeting_title}`)
        console.log(`     Original File: ${interview.transcript_file_name}`)
        console.log(`     Drive ID: ${interview.drive_file_id || 'NO DRIVE ID'}`)
        console.log(`     Date: ${interview.meeting_date}`)
        console.log(`     Type: ${interview.meeting_type}`)
        console.log(`     Candidate: ${interview.candidate_name}`)
      })
    } else {
      console.log('\n❌ Not found anywhere in database')
    }
    return
  }

  console.log('✓ Found exact match:')
  console.log(`  Meeting Title: ${data.meeting_title}`)
  console.log(`  Original Filename: ${data.transcript_file_name}`)
  console.log(`  Drive ID: ${data.drive_file_id}`)
  console.log(`  Date: ${data.meeting_date}`)
  console.log(`  Candidate: ${data.candidate_name}`)
  console.log(`  Type: ${data.meeting_type}`)
}

checkFile().catch(console.error)
