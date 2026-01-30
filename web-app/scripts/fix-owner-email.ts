import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://ebycqbmyqhejnimerzsy.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const fileIds = [
  '19duoBx_aL7Op5SomcY88LE6uO--V9fNCEeuek_OCrS8',
  '1y3tdrfqdv-_W6jP8oeACA8DxcoR0-xDFG9U0d0MMR88',
  '1_nSrM3GK4GUv8n2_FMdlpC5THt9dhfOhDuBdn3LIYD8',
  '1DJYTj2jWhVOqCqYCvdi29tcxgG-Ib9yLWi74TDEwwM8',
  '1sGCsbC5GqwkTbJqNYA4lfx9Fv6DDo1feogxi5MHLZrI',
  '1ueCJE-9ImGKeOpoEJUAsgWaU57Wuptp_aMsYDOPv96w'
]

async function checkAndFix() {
  console.log('🔍 Checking current owner_email values...\n')
  
  const { data: records, error: fetchError } = await supabase
    .from('interviews')
    .select('id, meeting_title, owner_email, drive_file_id')
    .in('drive_file_id', fileIds)
  
  if (fetchError) {
    console.error('❌ Error fetching:', fetchError)
    process.exit(1)
  }
  
  console.log(`Found ${records?.length || 0} records:\n`)
  records?.forEach(r => {
    console.log(`  ${r.meeting_title}`)
    console.log(`    owner_email: ${r.owner_email || 'NULL'}`)
    console.log(`    drive_file_id: ${r.drive_file_id}`)
    console.log()
  })
  
  const yourEmail = 'adam.perlis@academyux.com'
  
  console.log(`\n📝 Updating owner_email to: ${yourEmail}\n`)
  
  const { data: updated, error: updateError } = await supabase
    .from('interviews')
    .update({ owner_email: yourEmail })
    .in('drive_file_id', fileIds)
    .select('meeting_title')
  
  if (updateError) {
    console.error('❌ Update error:', updateError)
    process.exit(1)
  }
  
  console.log(`✅ Updated ${updated?.length || 0} records:`)
  updated?.forEach(r => console.log(`  • ${r.meeting_title}`))
  
  console.log('\n✨ Done! Your transcripts should now appear in History/Feedback.')
}

checkAndFix()
