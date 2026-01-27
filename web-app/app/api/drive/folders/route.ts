import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    const url = new URL(req.url)
    const query = url.searchParams.get('q') || ''
    
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

    // Build query
    // Always filter for folders and not trashed
    let q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    
    if (query) {
      // If user is searching, look for name contains
      q += ` and name contains '${query.replace(/'/g, "\\'")}'`
    }

    const response = await drive.files.list({
      q: q,
      fields: 'files(id, name, createdTime)',
      orderBy: 'folder,name', // Folders first (redundant since we only fetch folders), then name
      pageSize: 50,
    })

    const folders = response.data.files || []

    // If no search query, try to find "Meet Recordings" and put it first
    if (!query) {
      const meetIndex = folders.findIndex(f => f.name === 'Meet Recordings')
      if (meetIndex > -1) {
        const meetFolder = folders.splice(meetIndex, 1)[0]
        folders.unshift(meetFolder)
      } else {
        // If not found in the first 50, try to search for it specifically
        try {
          const meetRes = await drive.files.list({
            q: "name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id, name, createdTime)',
          })
          if (meetRes.data.files && meetRes.data.files.length > 0) {
             folders.unshift(meetRes.data.files[0])
          }
        } catch (e) {
          // Ignore error if specific search fails
          console.log('Could not find Meet Recordings folder explicitly')
        }
      }
    }

    console.log(`Drive folders found (${query ? 'search' : 'default'}):`, folders.length)
    return NextResponse.json({ folders })
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
