import { supabase } from '../lib/supabase'

async function runMigration() {
  console.log('Running migration: Add Client Debrief to meeting_type constraint...')
  
  try {
    // Drop old constraint
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE interviews DROP CONSTRAINT IF EXISTS check_meeting_type'
    })
    
    if (dropError) {
      console.error('Error dropping constraint:', dropError)
      // Continue anyway, constraint might not exist
    }
    
    // Add new constraint with all meeting types
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE interviews 
ADD CONSTRAINT check_meeting_type 
CHECK (meeting_type IS NULL OR meeting_type IN (
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
))`
    })
    
    if (addError) {
      console.error('Error adding constraint:', addError)
      process.exit(1)
    }
    
    console.log('✅ Migration completed successfully!')
    console.log('Meeting types now include: Interview, Client Debrief, Sales Meeting, etc.')
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
