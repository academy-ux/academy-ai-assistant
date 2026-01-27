import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in again.' }, { status: 401 })
    }
    
    if (!token.accessToken) {
      return NextResponse.json({ 
        error: 'No Drive access. Please sign out and sign in again to grant Drive permission.' 
      }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      orderBy: 'name',
      pageSize: 100,
    })

    console.log('Drive folders found:', response.data.files?.length || 0)
    return NextResponse.json({ folders: response.data.files || [] })
  } catch (error: any) {
    console.error('Drive folders error:', error)
    
    // Check for specific Google API errors
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json({ 
        error: 'Drive access expired. Please sign out and sign in again.' 
      }, { status: 401 })
    }
    
    if (error.code === 403) {
      return NextResponse.json({ 
        error: 'Drive access denied. Please sign out and sign in again to grant permission.' 
      }, { status: 403 })
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
