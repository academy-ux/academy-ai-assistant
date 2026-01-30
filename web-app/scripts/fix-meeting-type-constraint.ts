#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Create admin client with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixMeetingTypeConstraint() {
  console.log('🔧 Fixing meeting_type constraint...\n')

  try {
    // Step 1: Add meeting_type column if it doesn't exist
    console.log('📝 Step 1: Adding meeting_type column...')
    await executeSQL(`
      alter table interviews 
      add column if not exists meeting_type text;
    `)
    console.log('✅ Column added (or already exists)\n')

    // Step 2: Create index
    console.log('📝 Step 2: Creating index...')
    await executeSQL(`
      create index if not exists idx_interviews_meeting_type 
      on interviews(meeting_type);
    `)
    console.log('✅ Index created\n')

    // Step 3: Drop old constraint
    console.log('📝 Step 3: Dropping old constraint (if exists)...')
    await executeSQL(`
      alter table interviews 
      drop constraint if exists check_meeting_type;
    `)
    console.log('✅ Old constraint dropped\n')

    // Step 4: Add new constraint
    console.log('📝 Step 4: Adding new constraint with all meeting types...')
    await executeSQL(`
      alter table interviews 
      add constraint check_meeting_type 
      check (meeting_type is null or meeting_type in (
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
      ));
    `)
    console.log('✅ New constraint added\n')

    // Step 5: Verify
    console.log('📝 Step 5: Verifying migration...')
    const { data, error } = await supabase
      .from('interviews')
      .select('meeting_type')
      .limit(1)

    if (error) {
      throw error
    }

    console.log('✅ Verification successful!\n')
    console.log('🎉 Migration completed successfully!')
    console.log('\n✨ Valid meeting types are now:')
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
    validTypes.forEach(type => console.log(`  ✓ ${type}`))
    console.log('\n💡 Next: Try polling Drive again to import those 2 failed files!')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message || error)
    console.log('\n💡 Manual fix: Run this SQL in your Supabase dashboard SQL Editor:\n')
    console.log(`
-- Drop old constraint
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS check_meeting_type;

-- Add new constraint
ALTER TABLE interviews ADD CONSTRAINT check_meeting_type 
CHECK (meeting_type IS NULL OR meeting_type IN (
  'Interview', 'Client Debrief', 'Sales Meeting', 'Status Update',
  'Planning Meeting', 'Team Sync', 'Client Call', '1-on-1',
  'All Hands', 'Standup', 'Retrospective', 'Demo', 'Other'
));
    `)
    process.exit(1)
  }
}

async function executeSQL(sql: string) {
  // Use postgres connection to execute DDL statements
  // Supabase JS client doesn't support DDL directly, so we'll use a workaround
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey!,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql })
  }).catch(() => {
    // If RPC doesn't exist, we need to use Supabase dashboard
    throw new Error('Cannot execute SQL via API. Please use Supabase dashboard SQL Editor.')
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SQL execution failed: ${error}`)
  }
}

fixMeetingTypeConstraint()
