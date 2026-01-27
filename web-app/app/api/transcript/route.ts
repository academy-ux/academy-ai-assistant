import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const title = searchParams.get('title')
    const code = searchParams.get('code')

    if (!title && !code) {
      return NextResponse.json({ error: 'Missing title or code' }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })

    const drive = google.drive({ version: 'v3', auth })

    let query = "mimeType = 'application/vnd.google-apps.document' and trashed = false"
    
    // Construct search query
    // Google Meet transcripts usually contain the meeting code or title
    const conditions = []
    if (code) conditions.push(`name contains '${code}'`)
    if (title) conditions.push(`name contains '${title}'`)
    
    if (conditions.length > 0) {
      query += ` and (${conditions.join(' or ')})`
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 1,
    })

    const files = response.data.files
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, message: 'No transcript found' })
    }

    const file = files[0]

    // Export the file content
    const exportResponse = await drive.files.export({
      fileId: file.id!,
      mimeType: 'text/plain',
    })

    return NextResponse.json({
      success: true,
      transcript: exportResponse.data,
      fileName: file.name,
      fileId: file.id
    })

  } catch (error: any) {
    console.error('Transcript fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
