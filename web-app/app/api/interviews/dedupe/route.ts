import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/interviews/dedupe
 * Admin-only: find and remove duplicate transcripts.
 * Duplicates are identified by matching drive_file_id OR transcript_file_name.
 * Keeps the newest row (by created_at) in each group and deletes the rest.
 *
 * Query params:
 *   ?dryRun=true  — preview what would be deleted without actually deleting
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'

  // Fetch all interviews (only the fields we need for dedup)
  const { data: all, error } = await supabase
    .from('interviews')
    .select('id, drive_file_id, transcript_file_name, created_at, meeting_title')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!all || all.length === 0) {
    return NextResponse.json({ message: 'No interviews found', deleted: 0 })
  }

  // Group by drive_file_id and transcript_file_name
  // For each group, keep the first (newest) and mark the rest for deletion
  const seenByFileId = new Map<string, string>() // drive_file_id -> kept id
  const seenByFileName = new Map<string, string>() // transcript_file_name -> kept id
  const toDelete: { id: string; reason: string; title: string | null }[] = []

  for (const row of all) {
    let isDupe = false
    let reason = ''

    // Check drive_file_id first (most reliable)
    if (row.drive_file_id) {
      const existing = seenByFileId.get(row.drive_file_id)
      if (existing) {
        isDupe = true
        reason = `duplicate drive_file_id: ${row.drive_file_id}`
      } else {
        seenByFileId.set(row.drive_file_id, row.id)
      }
    }

    // Check transcript_file_name
    if (!isDupe && row.transcript_file_name) {
      const existing = seenByFileName.get(row.transcript_file_name)
      if (existing) {
        isDupe = true
        reason = `duplicate file name: ${row.transcript_file_name}`
      } else {
        seenByFileName.set(row.transcript_file_name, row.id)
      }
    }

    if (isDupe) {
      toDelete.push({ id: row.id, reason, title: row.meeting_title })
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ message: 'No duplicates found', deleted: 0 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `Dry run: would delete ${toDelete.length} duplicate(s)`,
      dryRun: true,
      duplicates: toDelete,
    })
  }

  // Delete in batches of 50
  let deleted = 0
  const BATCH = 50
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH).map(d => d.id)
    const { error: delError } = await supabase
      .from('interviews')
      .delete()
      .in('id', batch)

    if (delError) {
      console.error('[Dedupe] Batch delete error:', delError)
    } else {
      deleted += batch.length
    }
  }

  console.log(`[Dedupe] Deleted ${deleted} duplicate transcript(s)`)

  return NextResponse.json({
    message: `Deleted ${deleted} duplicate(s)`,
    deleted,
    duplicates: toDelete,
  })
}
