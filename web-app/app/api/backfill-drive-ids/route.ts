import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
export const dynamic = 'force-dynamic'
import { google, drive_v3 } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[Backfill] Starting for ${token.email}`)

    // Get Drive folder from settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('drive_folder_id, folder_name')
      .eq('user_email', token.email)
      .single()

    if (!settings?.drive_folder_id) {
      return NextResponse.json({
        error: 'No Drive folder configured'
      }, { status: 400 })
    }

    // Fetch all Drive files
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    console.log('[Backfill] Fetching Drive files...')
    const allDriveFiles: drive_v3.Schema$File[] = []
    let nextPageToken: string | null | undefined = undefined

    do {
      const listPromise: any = drive.files.list({
        q: `'${settings.drive_folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        pageToken: nextPageToken || undefined,
      })
      const driveResponse = await listPromise

      const listData = driveResponse.data
      const files = listData.files || []
      allDriveFiles.push(...files)
      nextPageToken = listData.nextPageToken
    } while (nextPageToken)

    console.log(`[Backfill] Found ${allDriveFiles.length} Drive files`)

    // Fetch database records without drive_file_id
    const { data: interviews, error } = await supabase
      .from('interviews')
      .select('id, meeting_title, transcript_file_name')
      .eq('owner_email', token.email)
      .is('drive_file_id', null)

    if (error) throw error

    console.log(`[Backfill] Found ${interviews?.length || 0} records without Drive ID`)

    // Create lookup map
    const driveFilesByName = new Map<string, string>()
    for (const file of allDriveFiles) {
      if (file.name && file.id) {
        driveFilesByName.set(file.name, file.id)
      }
    }

    // Match and update
    let matched = 0
    let updated = 0
    const updates: Array<{ id: string, title: string, driveId: string }> = []

    for (const interview of interviews || []) {
      if (!interview.transcript_file_name) continue

      const driveId = driveFilesByName.get(interview.transcript_file_name)

      if (driveId) {
        matched++

        const { error: updateError } = await supabase
          .from('interviews')
          .update({ drive_file_id: driveId })
          .eq('id', interview.id)

        if (!updateError) {
          updated++
          updates.push({
            id: interview.id,
            title: interview.meeting_title || 'Untitled',
            driveId
          })
        }
      }
    }

    console.log(`[Backfill] Matched: ${matched}, Updated: ${updated}`)

    return NextResponse.json({
      success: true,
      totalDriveFiles: allDriveFiles.length,
      recordsWithoutDriveId: interviews?.length || 0,
      matched,
      updated,
      unmatched: (interviews?.length || 0) - matched,
      sampleUpdates: updates.slice(0, 10)
    })

  } catch (error: any) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json({
      error: 'Backfill failed',
      details: error.message
    }, { status: 500 })
  }
}
