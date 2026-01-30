#!/usr/bin/env tsx

/**
 * Apply the ai_conversations migration to the remote Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('🚀 Applying ai_conversations migration...\n')

  // Read the migration file
  const migrationPath = path.join(
    __dirname,
    '../supabase/migrations/20260130150000_add_ai_conversations.sql'
  )

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration SQL:')
  console.log('─'.repeat(80))
  console.log(migrationSQL.substring(0, 500) + '...')
  console.log('─'.repeat(80))
  console.log()

  try {
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // If the RPC doesn't exist, we need to execute the SQL directly
      // Split into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'))

      console.log(`📝 Executing ${statements.length} SQL statements...\n`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        console.log(`  [${i + 1}/${statements.length}] Executing...`)

        const { error } = await supabase.rpc('exec_sql', { sql: statement })

        if (error) {
          // Try using the raw SQL endpoint
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ sql: statement }),
          })

          if (!response.ok) {
            console.error(`    ❌ Failed: ${error.message}`)
            console.error(`    Statement: ${statement.substring(0, 100)}...`)
          } else {
            console.log(`    ✅ Success`)
          }
        } else {
          console.log(`    ✅ Success`)
        }
      }
    }

    console.log('\n✅ Migration applied successfully!')
    console.log('\n📋 Verifying ai_conversations table exists...')

    // Verify the table exists
    const { data, error: verifyError } = await supabase
      .from('ai_conversations')
      .select('id')
      .limit(1)

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message)
      console.log('\n⚠️  You may need to run this migration manually via Supabase Studio.')
      console.log(`   Go to: ${supabaseUrl.replace('.supabase.co', '')}/project/_/sql`)
      process.exit(1)
    }

    console.log('✅ Table verified! You can now use the conversation history feature.')
  } catch (err) {
    console.error('❌ Error applying migration:', err)
    console.log('\n⚠️  Please run this migration manually via Supabase Studio:')
    console.log(`   1. Go to: ${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}/project/_/sql`)
    console.log('   2. Copy and paste the SQL from:', migrationPath)
    console.log('   3. Click "Run"')
    process.exit(1)
  }
}

main()
