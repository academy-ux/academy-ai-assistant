import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { driveQuerySchema, validateSearchParams, errorResponse } from '@/lib/validation'

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

    // Validate query parameter
    const { data: params, error: validationError } = validateSearchParams(
      req.nextUrl.searchParams,
      driveQuerySchema
    )
    if (validationError) return validationError

    const query = params.q

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // Build query - query is already validated to be alphanumeric
    let q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    
    if (query) {
      // Safe to use since we validated it only contains alphanumeric chars
      q += ` and name contains '${query}'`
    }

    const fields = 'files(id, name, createdTime, modifiedTime, owners(displayName, emailAddress), shared)'

    const response = await drive.files.list({
      q: q,
      fields: fields,
      orderBy: 'folder,modifiedTime desc',
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
        try {
          const meetRes = await drive.files.list({
            q: "name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: fields,
          })
          if (meetRes.data.files && meetRes.data.files.length > 0) {
             meetRes.data.files.sort((a, b) => {
               return (new Date(b.modifiedTime || 0).getTime()) - (new Date(a.modifiedTime || 0).getTime())
             })
             folders.unshift(...meetRes.data.files)
          }
        } catch (e) {
          // Ignore error if specific search fails
        }
      }
    }

    return NextResponse.json({ folders })
  } catch (error: any) {
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
    
    return errorResponse(error, 'Drive folders error')
  }
}
