import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function addColumn() {
  console.log('🚀 Adding submitted_at column...\n')

  // Try to fetch a single record to see if the column exists
  const { data: testData, error: testError } = await supabase
    .from('interviews')
    .select('submitted_at')
    .limit(1)

  if (testError) {
    if (testError.message.includes('column') || testError.message.includes('submitted_at')) {
      console.log('❌ Column does not exist. Need to add it via Supabase dashboard SQL editor.')
      console.log('\nPlease run this SQL in your Supabase SQL editor:')
      console.log('\n--- SQL START ---')
      console.log('ALTER TABLE interviews')
      console.log('ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;')
      console.log('')
      console.log('CREATE INDEX IF NOT EXISTS idx_interviews_submitted_at')
      console.log('  ON interviews(submitted_at DESC NULLS LAST);')
      console.log('--- SQL END ---\n')
      console.log('Then re-run the mark-interviews script.')
      return
    }
    console.error('❌ Unexpected error:', testError)
    return
  }

  console.log('✅ Column already exists!')
}

addColumn()
