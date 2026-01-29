import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function findRachel() {
  const { data, error } = await supabase
    .from('interviews')
    .select('candidate_name, meeting_date')
    .ilike('candidate_name', '%rachel%')
    .order('meeting_date', { ascending: true })

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Found Rachel candidates:')
    data?.forEach(d => console.log('  -', d.candidate_name, '|', d.meeting_date))
  }
}

findRachel()
