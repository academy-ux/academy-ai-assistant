import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await req.json()
    if (!fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // Get user's configured folder
    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', token.email)
      .single()

    // Get file details
    const fileResponse = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, parents, createdTime, modifiedTime, trashed, owners, shared'
    })

    const file = fileResponse.data

    // Check if file is already imported
    const { data: existingById } = await supabase
      .from('interviews')
      .select('id, meeting_title, created_at')
      .eq('drive_file_id', fileId)
      .maybeSingle()

    const { data: existingByName } = file.name
      ? await supabase
          .from('interviews')
          .select('id, meeting_title, created_at')
          .eq('transcript_file_name', file.name)
          .maybeSingle()
      : { data: null }

    // Get parent folder details if parents exist
    let parentDetails = []
    if (file.parents && file.parents.length > 0) {
      for (const parentId of file.parents) {
        try {
          const parentResponse = await drive.files.get({
            fileId: parentId,
            fields: 'id, name'
          })
          parentDetails.push(parentResponse.data)
        } catch (e) {
          parentDetails.push({ id: parentId, name: 'Unable to fetch' })
        }
      }
    }

    // Check if file would match the polling query
    const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document'
    const isNotTrashed = !file.trashed
    const isInConfiguredFolder = settings?.drive_folder_id && file.parents?.includes(settings.drive_folder_id)
    
    // Check if modified after last poll
    let isAfterLastPoll = true
    if (settings?.last_poll_time && file.modifiedTime) {
      const lastPollDate = new Date(settings.last_poll_time)
      lastPollDate.setMinutes(lastPollDate.getMinutes() - 5)
      const fileModifiedDate = new Date(file.modifiedTime)
      isAfterLastPoll = fileModifiedDate > lastPollDate
    }

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        trashed: file.trashed,
        shared: file.shared,
        owners: file.owners,
        parents: parentDetails
      },
      userSettings: {
        configuredFolderId: settings?.drive_folder_id,
        configuredFolderName: settings?.folder_name,
        lastPollTime: settings?.last_poll_time
      },
      alreadyImported: {
        byId: existingById,
        byName: existingByName
      },
      pollingChecks: {
        isGoogleDoc: { value: isGoogleDoc, required: true },
        isNotTrashed: { value: isNotTrashed, required: true },
        isInConfiguredFolder: { value: isInConfiguredFolder, required: true },
        isAfterLastPoll: { value: isAfterLastPoll, required: true }
      },
      wouldBeDetected: isGoogleDoc && isNotTrashed && isInConfiguredFolder && isAfterLastPoll
    })

  } catch (error: any) {
    console.error('[Debug File] Error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error.message 
    }, { status: 500 })
  }
}
