import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const { data: all, error } = await supabase
    .from('interviews')
    .select('id, drive_file_id, transcript_file_name, created_at, meeting_title')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Total interviews:', all.length)

  const seenByFileId = new Map<string, string>()
  const seenByFileName = new Map<string, string>()
  const toDelete: { id: string; title: string | null; reason: string }[] = []

  for (const row of all) {
    let isDupe = false
    let reason = ''

    if (row.drive_file_id) {
      if (seenByFileId.has(row.drive_file_id)) {
        isDupe = true
        reason = 'duplicate drive_file_id'
      } else {
        seenByFileId.set(row.drive_file_id, row.id)
      }
    }

    if (isDupe === false && row.transcript_file_name) {
      if (seenByFileName.has(row.transcript_file_name)) {
        isDupe = true
        reason = 'duplicate file_name'
      } else {
        seenByFileName.set(row.transcript_file_name, row.id)
      }
    }

    if (isDupe) {
      toDelete.push({ id: row.id, title: row.meeting_title, reason })
    }
  }

  console.log(`\nDuplicates found: ${toDelete.length}`)

  if (toDelete.length === 0) {
    console.log('Nothing to clean up!')
    return
  }

  toDelete.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.title || '(no title)'} — ${d.reason}`)
  })

  console.log(`\nUnique interviews remaining: ${all.length - toDelete.length}`)

  if (dryRun) {
    console.log('\n[DRY RUN] No records deleted. Run without --dry-run to delete.')
    return
  }

  // Delete in batches
  let deleted = 0
  const BATCH = 50
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const ids = toDelete.slice(i, i + BATCH).map(d => d.id)
    const { error: delError } = await supabase
      .from('interviews')
      .delete()
      .in('id', ids)

    if (delError) {
      console.error('Delete error:', delError)
    } else {
      deleted += ids.length
    }
  }

  console.log(`\nDeleted ${deleted} duplicate(s).`)
}

main()
