import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'

// Debug endpoint to see what files are in Drive
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', token.email)
      .single()

    if (settingsError || !settings?.drive_folder_id) {
      return NextResponse.json({ 
        error: 'No Drive folder configured. Please import a folder first.' 
      }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // Get files from the past 48 hours
    const twoDaysAgo = new Date()
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48)
    
    const query = `'${settings.drive_folder_id}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false and modifiedTime > '${twoDaysAgo.toISOString()}'`

    console.log('[Debug Poll] Query:', query)

    const listResponse = await drive.files.list({
      q: query,
      fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
      pageSize: 50,
      orderBy: 'modifiedTime desc',
    })

    const files = listResponse.data.files || []

    // Check which files are already imported
    const fileDetails = await Promise.all(files.map(async (file) => {
      const { data: existingById } = await supabase
        .from('interviews')
        .select('id, meeting_title')
        .eq('drive_file_id', file.id)
        .maybeSingle()

      const { data: existingByName } = await supabase
        .from('interviews')
        .select('id, meeting_title')
        .eq('transcript_file_name', file.name)
        .maybeSingle()

      return {
        name: file.name,
        id: file.id,
        created: file.createdTime,
        modified: file.modifiedTime,
        link: file.webViewLink,
        alreadyImported: !!(existingById || existingByName),
        importedAs: existingById?.meeting_title || existingByName?.meeting_title || null
      }
    }))

    return NextResponse.json({
      folderName: settings.folder_name,
      folderId: settings.drive_folder_id,
      checkingSince: twoDaysAgo.toISOString(),
      totalFiles: files.length,
      alreadyImported: fileDetails.filter(f => f.alreadyImported).length,
      newFiles: fileDetails.filter(f => !f.alreadyImported).length,
      files: fileDetails
    })

  } catch (error: any) {
    console.error('[Debug Poll] Error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error.message 
    }, { status: 500 })
  }
}
