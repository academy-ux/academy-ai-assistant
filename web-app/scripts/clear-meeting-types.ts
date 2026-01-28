/**
 * Clear meeting_type to allow re-categorization
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearMeetingTypes() {
  console.log('🧹 Clearing meeting types for re-categorization...')
  
  const { error } = await supabase
    .from('interviews')
    .update({ meeting_type: null })
    .not('meeting_type', 'is', null)
  
  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
  
  console.log('✅ Meeting types cleared!')
}

clearMeetingTypes()
