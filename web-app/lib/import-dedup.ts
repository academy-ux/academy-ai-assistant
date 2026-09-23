import { supabase } from '@/lib/supabase'
import { drive_v3 } from 'googleapis'

// Postgres unique_violation — raised by the interviews_drive_file_id_key index
// when two imports of the same Drive file race each other.
export const UNIQUE_VIOLATION = '23505'

/**
 * Returns the id of an existing interview for this Drive file, or null if it
 * hasn't been imported yet. Shared by the cron poller and both manual import
 * routes so they all agree on what "already imported" means.
 *
 * Lookups use limit(1) rather than maybeSingle(): maybeSingle() returns
 * { data: null, error } when more than one row matches, which previously read
 * as "not imported" and re-imported the file again — a duplicate that then
 * guaranteed every later lookup failed the same way.
 *
 * There is deliberately no file-name match. Gemini names docs
 * "<Guest> and <Host>", so repeat meetings with the same person share a name;
 * matching on it silently skipped every follow-up meeting.
 */
export async function findExistingImport(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  ownerEmail: string | null | undefined
): Promise<{ id: string } | null> {
  if (file.id) {
    const { data, error } = await supabase
      .from('interviews')
      .select('id')
      .eq('drive_file_id', file.id)
      .limit(1)
    // On a lookup failure, report "exists" so we skip this run instead of
    // inserting blind; the next poll will retry.
    if (error) {
      console.error(`[Dedup] Lookup failed for ${file.id}:`, error.message)
      return { id: 'lookup-failed' }
    }
    if (data && data.length > 0) return { id: data[0].id }
  }

  // Cross-pathway check: a Chrome extension upload (drive_file_id "meet-<code>")
  // of the same meeting, same owner and day. If the transcript matches, re-link
  // that row to this Drive file instead of creating a second one.
  if (file.id && file.createdTime && ownerEmail) {
    const fileDate = new Date(file.createdTime)
    const startOfDay = new Date(fileDate); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(fileDate); endOfDay.setHours(23, 59, 59, 999)

    const { data: candidates } = await supabase
      .from('interviews')
      .select('id, transcript')
      .eq('owner_email', ownerEmail)
      .like('drive_file_id', 'meet-%')
      .gte('meeting_date', startOfDay.toISOString())
      .lte('meeting_date', endOfDay.toISOString())

    if (candidates && candidates.length > 0) {
      try {
        const previewRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' })
        const previewWords = ((previewRes.data as string) || '').substring(0, 500).split(/\s+/).filter(Boolean)

        for (const candidate of candidates) {
          const existingSnippet = (candidate.transcript || '').substring(0, 500)
          if (!existingSnippet || previewWords.length === 0) continue
          const overlap = previewWords.filter((w) => existingSnippet.includes(w)).length
          if (overlap / previewWords.length > 0.6) {
            await supabase
              .from('interviews')
              .update({ drive_file_id: file.id })
              .eq('id', candidate.id)
            console.log(`[Dedup] Linked extension upload ${candidate.id} to Drive file ${file.id}`)
            return { id: candidate.id }
          }
        }
      } catch (previewError) {
        // If we can't preview, skip this check rather than blocking import
        console.error('[Dedup] Preview comparison failed:', previewError)
      }
    }
  }

  return null
}

/**
 * Final guard against the same meeting arriving as two different Drive files
 * (e.g. Tactiq + Google native transcript) that produce the same generated title.
 */
export async function titleAlreadyImported(title: string, ownerEmail: string): Promise<boolean> {
  const { data } = await supabase
    .from('interviews')
    .select('id')
    .eq('meeting_title', title)
    .eq('owner_email', ownerEmail)
    .limit(1)
  return !!data && data.length > 0
}
