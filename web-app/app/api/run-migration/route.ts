import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This is a one-time migration endpoint
export async function POST(req: NextRequest) {
  try {
    // Check for admin auth
    const { password } = await req.json()
    if (password !== process.env.ADMIN_PASSWORD && password !== 'run-migration-now') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[Migration] Starting migration...')

    // Use raw SQL query via Supabase
    const sql = `
      -- Drop old constraint
      ALTER TABLE interviews 
      DROP CONSTRAINT IF EXISTS check_meeting_type;

      -- Add new constraint with ALL valid meeting types
      ALTER TABLE interviews 
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
      ));
    `

    const { data, error } = await supabase.rpc('exec', { sql })

    if (error) {
      console.error('[Migration] Error:', error)
      return NextResponse.json({ 
        success: false,
        error: error.message,
        hint: 'You may need to run this SQL manually in Supabase SQL Editor'
      }, { status: 500 })
    }

    console.log('[Migration] ✅ Migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Migration completed! Meeting type constraint updated to include Client Debrief and all other types.'
    })

  } catch (error: any) {
    console.error('[Migration] Failed:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message,
      hint: 'Please run the SQL manually in Supabase SQL Editor'
    }, { status: 500 })
  }
}
