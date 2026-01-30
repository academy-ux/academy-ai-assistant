/**
 * Script to assign owner_email to all meetings that currently have NULL owner_email
 * Run with: npx tsx scripts/assign-owner-email.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const ownerEmail = 'adam.perlis@academyux.com'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function assignOwnerEmail() {
  console.log('🚀 Starting to assign owner_email to ALL meetings...\n')
  console.log(`📧 Target email: ${ownerEmail}\n`)

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Error counting interviews:', countError)
    process.exit(1)
  }

  console.log(`📊 Total meetings in database: ${totalCount}\n`)

  // Check current distribution (fetch all records to avoid limit issues)
  const emailCounts: Record<string, number> = {}
  let distOffset = 0
  const distBatchSize = 1000
  
  while (true) {
    const { data: batch, error: distError } = await supabase
      .from('interviews')
      .select('owner_email')
      .range(distOffset, distOffset + distBatchSize - 1)
    
    if (distError) {
      console.error('❌ Error fetching current distribution:', distError)
      process.exit(1)
    }
    
    if (!batch || batch.length === 0) break
    
    batch.forEach((item) => {
      const email = item.owner_email || '(NULL)'
      emailCounts[email] = (emailCounts[email] || 0) + 1
    })
    
    distOffset += distBatchSize
    if (batch.length < distBatchSize) break
  }

  console.log('📧 Current owner_email distribution:')
  Object.entries(emailCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([email, count]) => {
      console.log(`   ${email.padEnd(40)} ${count} meetings`)
    })
  console.log('')

  // Update ALL meetings to have the target owner_email
  // Fetch all IDs and update in batches to ensure we get everything
  const batchSize = 1000
  let updated = 0
  let offset = 0
  
  console.log('🔄 Updating meetings in batches...\n')
  
  while (true) {
    const { data: batch, error: fetchError } = await supabase
      .from('interviews')
      .select('id, owner_email')
      .range(offset, offset + batchSize - 1)
    
    if (fetchError) {
      console.error('❌ Error fetching batch:', fetchError)
      process.exit(1)
    }
    
    if (!batch || batch.length === 0) break
    
    // Filter to only update those that need updating
    const idsToUpdate = batch
      .filter(r => r.owner_email !== ownerEmail)
      .map(r => r.id)
    
    if (idsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('interviews')
        .update({ owner_email: ownerEmail })
        .in('id', idsToUpdate)
      
      if (updateError) {
        console.error('❌ Error updating batch:', updateError)
        process.exit(1)
      }
      
      updated += idsToUpdate.length
      console.log(`   Updated batch: ${idsToUpdate.length} meetings (${updated}/${totalCount} total)`)
    }
    
    offset += batchSize
    
    if (batch.length < batchSize) break
  }

  console.log(`\n✅ Successfully updated ${updated} meetings`)
  console.log(`   All ${totalCount} meetings now have owner_email: ${ownerEmail}\n`)

  // Verify the update
  const { count: remainingNull, error: verifyError } = await supabase
    .from('interviews')
    .select('*', { count: 'exact', head: true })
    .is('owner_email', null)

  if (verifyError) {
    console.error('⚠️  Error verifying update:', verifyError)
  } else {
    console.log(`📊 Remaining meetings with NULL owner_email: ${remainingNull}`)
  }
}

// Run the script
assignOwnerEmail()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  })
