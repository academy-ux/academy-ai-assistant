import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function runMigration() {
  console.log('🚀 Running migration to add submitted_at column...\n')

  const sqlPath = path.resolve(process.cwd(), 'scripts/add-submitted-at-column.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // Try running it directly if rpc doesn't work
    console.log('Trying direct execution...')
    const statements = sql.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      const trimmed = statement.trim()
      if (!trimmed) continue
      
      console.log(`Executing: ${trimmed.substring(0, 50)}...`)
      const { error: execError } = await supabase.rpc('exec', { sql: trimmed })
      
      if (execError) {
        console.error('❌ Error:', execError)
      } else {
        console.log('✅ Success')
      }
    }
  } else {
    console.log('✅ Migration completed successfully!')
  }
}

runMigration()
