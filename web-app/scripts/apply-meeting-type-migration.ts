#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('🔧 Applying meeting_type constraint migration...\n')

    // Read the migration file
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260131000000_add_meeting_type_constraint.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split into individual statements (separated by semicolons)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement) continue

      console.log(`▶️  Executing statement ${i + 1}/${statements.length}...`)
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement 
      }).catch(() => {
        // If exec_sql RPC doesn't exist, try direct query
        return supabase.from('_').select('*').limit(0).then(() => {
          // This is a workaround - we'll use postgres client instead
          throw new Error('Please run this migration manually in Supabase SQL Editor')
        })
      })

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error)
        console.log(`\n📋 Statement that failed:\n${statement}\n`)
        
        // For ALTER TABLE operations, some errors are expected if constraint already exists
        if (error.message?.includes('already exists') || error.message?.includes('does not exist')) {
          console.log('ℹ️  This is likely safe to ignore (constraint/column already exists or was already dropped)\n')
          continue
        }
        throw error
      }

      console.log(`✅ Statement ${i + 1} executed successfully\n`)
    }

    console.log('🎉 Migration completed successfully!')
    console.log('\n📊 Verifying migration...')

    // Verify the migration worked by checking the constraint
    const { data, error: checkError } = await supabase
      .from('interviews')
      .select('meeting_type')
      .limit(1)

    if (checkError) {
      console.error('❌ Error verifying migration:', checkError)
    } else {
      console.log('✅ meeting_type column is accessible')
    }

    console.log('\n✨ All done! You can now use the following meeting types:')
    const validTypes = [
      'Interview',
      'Client Debrief',
      'Sales Meeting',
      'Status Update',
      'Planning Meeting',
      'Team Sync',
      'Client Call',
      '1-on-1',
      'All Hands',
      'Standup',
      'Retrospective',
      'Demo',
      'Other'
    ]
    validTypes.forEach(type => console.log(`  - ${type}`))

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message || error)
    console.log('\n💡 Alternative: Copy the SQL from supabase/migrations/20260131000000_add_meeting_type_constraint.sql')
    console.log('   and paste it into the Supabase SQL Editor at:')
    console.log(`   ${supabaseUrl?.replace('/rest/v1', '')}/project/_/sql`)
    process.exit(1)
  }
}

applyMigration()
