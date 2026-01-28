import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'

const transcriptQuerySchema = z.object({
  title: z.string().max(200).optional(),
  code: z.string().max(50).regex(/^[a-zA-Z0-9\-]*$/, 'Invalid meeting code format').optional(),
}).refine(data => data.title || data.code, {
  message: 'Either title or code is required'
})

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate query params
    const { data: params, error: validationError } = validateSearchParams(
      req.nextUrl.searchParams,
      transcriptQuerySchema
    )
    if (validationError) return validationError

    const { title, code } = params

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })

    const drive = google.drive({ version: 'v3', auth })

    let query = "mimeType = 'application/vnd.google-apps.document' and trashed = false"
    
    // Construct search query - inputs are validated
    const conditions = []
    if (code) conditions.push(`name contains '${code}'`)
    if (title) {
      // Escape single quotes in title
      const escapedTitle = title.replace(/'/g, "\\'")
      conditions.push(`name contains '${escapedTitle}'`)
    }
    
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

  } catch (error) {
    return errorResponse(error, 'Transcript fetch error')
  }
}
