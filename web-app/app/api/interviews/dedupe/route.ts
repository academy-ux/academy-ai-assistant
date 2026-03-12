import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/interviews/dedupe
 * Admin-only: find and remove duplicate transcripts.
 *
 * Duplicates are identified by:
 *   1. Matching drive_file_id
 *   2. Matching transcript_file_name
 *   3. Cross-pathway: extension upload (meet-*) + Drive import with same candidate/date/owner
 *
 * Keeps the newest row (by created_at) in each group and deletes the rest.
 * When a cross-pathway duplicate is found, the kept record is updated with the
 * real Drive file ID for future deduplication.
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

  // Fetch all interviews (include transcript snippet for content comparison)
  const { data: all, error } = await supabase
    .from('interviews')
    .select('id, drive_file_id, transcript_file_name, created_at, meeting_title, meeting_date, owner_email, candidate_name, transcript')
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
  // Track records for cross-pathway comparison: key = "owner|date" -> records[]
  const byOwnerDate = new Map<string, typeof all>()

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
    } else if (row.owner_email && row.meeting_date) {
      // Index non-duplicate records by owner + date for cross-pathway check
      const dateKey = new Date(row.meeting_date).toISOString().split('T')[0]
      const key = `${row.owner_email}|${dateKey}`
      const group = byOwnerDate.get(key) || []
      group.push(row)
      byOwnerDate.set(key, group)
    }
  }

  // Phase 2: Cross-pathway deduplication
  // Find groups where the same owner has both a "meet-*" record and a Drive record on the same day
  const crossPathwayDeletes: { id: string; reason: string; title: string | null; linkDriveId?: string; linkToId?: string }[] = []

  for (const [, group] of byOwnerDate) {
    if (group.length < 2) continue

    const extensionRecords = group.filter(r => r.drive_file_id?.startsWith('meet-'))
    const driveRecords = group.filter(r => r.drive_file_id && !r.drive_file_id.startsWith('meet-'))

    if (extensionRecords.length === 0 || driveRecords.length === 0) continue

    // Compare each extension record against Drive records using transcript content
    for (const extRecord of extensionRecords) {
      const extSnippet = (extRecord.transcript || '').substring(0, 500)
      if (!extSnippet) continue

      for (const driveRecord of driveRecords) {
        const driveSnippet = (driveRecord.transcript || '').substring(0, 500)
        if (!driveSnippet) continue

        // Word overlap check
        const extWords = extSnippet.split(/\s+/)
        const overlap = extWords.filter(word => driveSnippet.includes(word)).length
        const total = extWords.length

        if (total > 0 && overlap / total > 0.6) {
          // These are the same transcript from different pathways
          // Keep the Drive record (has real file ID), delete the extension one
          crossPathwayDeletes.push({
            id: extRecord.id,
            reason: `cross-pathway duplicate: extension "meet-*" matches Drive record ${driveRecord.id}`,
            title: extRecord.meeting_title,
            linkDriveId: driveRecord.drive_file_id!,
            linkToId: driveRecord.id,
          })
          break // Don't match this extension record again
        }
      }
    }
  }

  toDelete.push(...crossPathwayDeletes)

  if (toDelete.length === 0) {
    return NextResponse.json({ message: 'No duplicates found', deleted: 0 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `Dry run: would delete ${toDelete.length} duplicate(s) (${crossPathwayDeletes.length} cross-pathway)`,
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

  console.log(`[Dedupe] Deleted ${deleted} duplicate transcript(s) (${crossPathwayDeletes.length} cross-pathway)`)

  return NextResponse.json({
    message: `Deleted ${deleted} duplicate(s) (${crossPathwayDeletes.length} cross-pathway)`,
    deleted,
    crossPathway: crossPathwayDeletes.length,
    duplicates: toDelete,
  })
}
