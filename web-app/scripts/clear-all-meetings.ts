import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearAllMeetings() {
  try {
    console.log('🗑️  Starting to clear all meetings...\n')
    
    // First, get count of meetings
    const { count: totalCount, error: countError } = await supabase
      .from('interviews')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw countError
    
    if (!totalCount || totalCount === 0) {
      console.log('✅ No meetings found in database. Already clean!')
      return
    }
    
    console.log(`📊 Found ${totalCount} meetings to delete\n`)
    
    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete ALL meetings from the database!')
    console.log('⚠️  This action cannot be undone.\n')
    
    // Delete all records
    const { error: deleteError } = await supabase
      .from('interviews')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (using a condition that matches everything)
    
    if (deleteError) throw deleteError
    
    console.log('==================================================')
    console.log('✅ Successfully deleted all meetings!')
    console.log('==================================================')
    console.log(`🗑️  Deleted: ${totalCount} meetings`)
    console.log('✨ Database is now clean and ready for fresh imports!\n')
    
  } catch (error) {
    console.error('❌ Error clearing meetings:', error)
    process.exit(1)
  }
}

clearAllMeetings()
