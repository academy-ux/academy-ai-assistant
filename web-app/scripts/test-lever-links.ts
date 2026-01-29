/**
 * Test script to see what Lever returns for candidate links
 * Run with: npx tsx scripts/test-lever-links.ts
 */

async function testLeverLinks() {
  const leverKey = process.env.LEVER_API_KEY

  if (!leverKey) {
    console.error('❌ LEVER_API_KEY not found in environment')
    process.exit(1)
  }

  console.log('✓ Lever API key found')
  console.log('📡 Fetching candidates from Lever...\n')

  try {
    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=10&expand=contact',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()
    const opportunities = data.data || []

    console.log(`Found ${opportunities.length} candidates\n`)
    console.log('=' .repeat(80))

    let candidatesWithLinks = 0

    opportunities.forEach((opp: any, index: number) => {
      const contact = opp.contact || {}
      const name = contact.name || 'Unknown'
      const links = contact.links || []

      console.log(`\n${index + 1}. ${name}`)
      console.log('-'.repeat(80))
      
      if (links.length === 0) {
        console.log('   ⚠️  NO LINKS FOUND')
      } else {
        candidatesWithLinks++
        console.log(`   ✓ Found ${links.length} link(s):`)
        links.forEach((link: any, i: number) => {
          console.log(`   ${i + 1}. Type: ${typeof link}`)
          console.log(`      Raw: ${JSON.stringify(link)}`)
          
          // Try different ways to extract URL
          if (typeof link === 'string') {
            console.log(`      → URL: ${link}`)
          } else if (link && typeof link === 'object') {
            console.log(`      → link.url: ${link.url || 'not found'}`)
            console.log(`      → link.href: ${link.href || 'not found'}`)
            console.log(`      → link.value: ${link.value || 'not found'}`)
            console.log(`      → Keys: ${Object.keys(link).join(', ')}`)
          }
        })
      }

      // Show resume
      if (opp.resumeUrl) {
        console.log(`   📄 Resume: ${opp.resumeUrl}`)
      }

      // Show emails
      if (contact.emails && contact.emails.length > 0) {
        console.log(`   📧 Email: ${contact.emails[0]}`)
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log(`\n📊 Summary:`)
    console.log(`   Total candidates: ${opportunities.length}`)
    console.log(`   With links: ${candidatesWithLinks}`)
    console.log(`   Without links: ${opportunities.length - candidatesWithLinks}`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

testLeverLinks()
