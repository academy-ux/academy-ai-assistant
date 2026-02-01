import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google, drive_v3 } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Drive folder from settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('drive_folder_id, folder_name')
      .eq('user_email', token.email)
      .single()

    if (!settings?.drive_folder_id) {
      return NextResponse.json({ 
        error: 'No Drive folder configured',
        message: 'Please configure your Drive folder in Settings first'
      }, { status: 400 })
    }

    // Fetch all files from Drive folder
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    type DriveFile = drive_v3.Schema$File
    const allDriveFiles: DriveFile[] = []
    let nextPageToken: string | null | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const listResponse: drive_v3.Schema$FileList = (await drive.files.list({
        q: `'${settings.drive_folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
        pageSize: 100,
        orderBy: 'modifiedTime desc',
        pageToken: nextPageToken || undefined,
      })).data

      const files = listResponse.files || []
      allDriveFiles.push(...files)
      nextPageToken = listResponse.nextPageToken
      hasMore = !!nextPageToken
    }

    // Fetch all interviews from database for this user
    const { data: dbInterviews, error: dbError } = await supabase
      .from('interviews')
      .select('id, meeting_title, transcript_file_name, drive_file_id, meeting_date, owner_email')
      .eq('owner_email', token.email)
      .order('meeting_date', { ascending: false })

    if (dbError) throw dbError

    // Create lookup maps
    const driveFilesById = new Map(allDriveFiles.map(f => [f.id!, f]))
    const driveFilesByName = new Map(allDriveFiles.map(f => [f.name!, f]))
    
    const dbInterviewsById = new Map(
      dbInterviews?.filter(i => i.drive_file_id).map(i => [i.drive_file_id!, i]) || []
    )
    const dbInterviewsByName = new Map(
      dbInterviews?.filter(i => i.transcript_file_name).map(i => [i.transcript_file_name!, i]) || []
    )

    // Find files in Drive but NOT in database
    const inDriveNotInDb = allDriveFiles.filter(driveFile => {
      const inDbById = driveFile.id && dbInterviewsById.has(driveFile.id)
      const inDbByName = driveFile.name && dbInterviewsByName.has(driveFile.name)
      return !inDbById && !inDbByName
    }).map(f => ({
      driveId: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
      createdTime: f.createdTime
    }))

    // Find files in database but NOT in Drive
    const inDbNotInDrive = (dbInterviews || []).filter(dbInterview => {
      // Check if this database record matches any Drive file
      const inDriveById = dbInterview.drive_file_id && driveFilesById.has(dbInterview.drive_file_id)
      const inDriveByName = dbInterview.transcript_file_name && driveFilesByName.has(dbInterview.transcript_file_name)
      return !inDriveById && !inDriveByName
    }).map(i => ({
      dbId: i.id,
      title: i.meeting_title,
      fileName: i.transcript_file_name,
      driveId: i.drive_file_id,
      date: i.meeting_date
    }))

    // Files that match
    const matched = allDriveFiles.filter(driveFile => {
      const inDbById = driveFile.id && dbInterviewsById.has(driveFile.id)
      const inDbByName = driveFile.name && dbInterviewsByName.has(driveFile.name)
      return inDbById || inDbByName
    }).map(f => ({
      driveId: f.id,
      name: f.name,
      dbRecord: dbInterviewsById.get(f.id!) || dbInterviewsByName.get(f.name!)
    }))

    return NextResponse.json({
      folderName: settings.folder_name,
      folderId: settings.drive_folder_id,
      summary: {
        totalInDrive: allDriveFiles.length,
        totalInDatabase: dbInterviews?.length || 0,
        matched: matched.length,
        inDriveNotInDb: inDriveNotInDb.length,
        inDbNotInDrive: inDbNotInDrive.length
      },
      inDriveNotInDb,
      inDbNotInDrive,
      matched: matched.slice(0, 10) // Just show first 10 for brevity
    })

  } catch (error: any) {
    console.error('Debug sync error:', error)
    return NextResponse.json({ 
      error: 'Failed to check sync status',
      details: error.message 
    }, { status: 500 })
  }
}
