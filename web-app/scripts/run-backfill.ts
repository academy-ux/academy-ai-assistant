// Simple script to call the backfill API endpoint
import fetch from 'node-fetch'

const ACCESS_TOKEN = process.argv[2]

if (!ACCESS_TOKEN) {
  console.error('❌ Please provide your session token')
  console.error('\nTo get your token:')
  console.error('1. Open your browser to: http://localhost:3000')
  console.error('2. Open DevTools (F12)')
  console.error('3. Go to Application > Cookies')
  console.error('4. Copy the value of "next-auth.session-token" or "__Secure-next-auth.session-token"')
  console.error('\nThen run: npx tsx scripts/run-backfill.ts YOUR_TOKEN_HERE')
  process.exit(1)
}

async function runBackfill() {
  console.log('🔧 Running Drive ID backfill via API...\n')

  try {
    const response = await fetch('http://localhost:3000/api/backfill-drive-ids', {
      method: 'POST',
      headers: {
        'Cookie': `next-auth.session-token=${ACCESS_TOKEN}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Error:', data.error)
      if (data.details) console.error('   ', data.details)
      process.exit(1)
    }

    console.log('✅ Backfill Complete!\n')
    console.log('📊 Results:')
    console.log(`   Total Drive files: ${data.totalDriveFiles}`)
    console.log(`   Records without Drive ID: ${data.recordsWithoutDriveId}`)
    console.log(`   ✓ Matched: ${data.matched}`)
    console.log(`   ✓ Updated: ${data.updated}`)
    console.log(`   Unmatched: ${data.unmatched}`)

    if (data.sampleUpdates && data.sampleUpdates.length > 0) {
      console.log('\n📝 Sample updated records:')
      data.sampleUpdates.forEach((update: any, i: number) => {
        console.log(`   ${i + 1}. ${update.title}`)
        console.log(`      Drive ID: ${update.driveId}`)
      })
    }

  } catch (error: any) {
    console.error('❌ Failed to run backfill:', error.message)
    process.exit(1)
  }
}

runBackfill()
