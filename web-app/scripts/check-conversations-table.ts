#!/usr/bin/env tsx

/**
 * Check if the ai_conversations table exists
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') })

import { supabase } from '../lib/supabase'

async function main() {
  console.log('🔍 Checking if ai_conversations table exists...\n')

  try {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id')
      .limit(1)

    if (error) {
      console.log('❌ Table does not exist or there was an error:', error.message)
      console.log('\n📋 You need to run the migration. Here are two options:\n')
      console.log('Option 1: Via Supabase Studio (Recommended)')
      console.log('  1. Go to your Supabase project dashboard')
      console.log('  2. Click "SQL Editor" in the left sidebar')
      console.log('  3. Copy the contents of:')
      console.log('     web-app/supabase/migrations/20260130150000_add_ai_conversations.sql')
      console.log('  4. Paste into the SQL Editor and click "Run"\n')
      console.log('Option 2: Via Supabase CLI')
      console.log('  1. Install Supabase CLI: https://supabase.com/docs/guides/cli')
      console.log('  2. Link your project: npx supabase link --project-ref <your-project-ref>')
      console.log('  3. Push migrations: npx supabase db push\n')
      return
    }

    console.log('✅ Table exists!')
    console.log(`   Found ${data?.length || 0} conversations\n`)
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

main()
