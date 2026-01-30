#!/usr/bin/env tsx

/**
 * Apply the ai_conversations migration to the remote Supabase database
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local')
  process.exit(1)
}

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

  console.log('📄 Executing migration SQL via HTTP...\n')

  try {
    // Use the Supabase REST API to execute raw SQL
    // We need to use the `_sql` endpoint which requires proper auth
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: migrationSQL }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // If exec_sql doesn't exist, provide manual instructions
      console.log('⚠️  Cannot execute SQL directly via API.\n')
      console.log('📋 Please apply the migration manually via Supabase Studio:\n')
      console.log(`1. Go to: ${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}/project/_/sql/new`)
      console.log('2. Copy and paste the following SQL:\n')
      console.log('─'.repeat(80))
      console.log(migrationSQL)
      console.log('─'.repeat(80))
      console.log('\n3. Click "Run"')
      console.log('\n💡 Or copy from:', migrationPath)
      return
    }

    console.log('✅ Migration applied successfully!\n')

    // Verify the table exists
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id')
      .limit(1)

    if (error) {
      console.log('⚠️  Migration may have been applied but verification failed:', error.message)
      console.log('   Check your Supabase dashboard to confirm the table exists.')
    } else {
      console.log('✅ Table verified! You can now use the conversation history feature.')
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message)
    console.log('\n📋 Please apply the migration manually via Supabase Studio:')
    console.log(`   Go to: ${supabaseUrl}/project/_/sql/new`)
    console.log('   And paste the SQL from:', migrationPath)
  }
}

main()
