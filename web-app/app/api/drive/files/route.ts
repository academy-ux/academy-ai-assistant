import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google, drive_v3 } from 'googleapis'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'
import { supabase } from '@/lib/supabase'

const filesQuerySchema = z.object({
  folderId: z.string()
    .min(1, 'Folder ID required')
    .max(100, 'Folder ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder ID format'),
})

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: params, error: validationError } = validateSearchParams(
      req.nextUrl.searchParams,
      filesQuerySchema
    )
    if (validationError) return validationError

    const { folderId } = params

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // Paginate through ALL Google Docs in the folder
    type DriveFile = drive_v3.Schema$File
    const allFiles: DriveFile[] = []
    let nextPageToken: string | null | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const listResponse: drive_v3.Schema$FileList = (await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
        pageSize: 100,
        orderBy: 'modifiedTime desc',
        pageToken: nextPageToken || undefined,
      })).data

      const files = listResponse.files || []
      allFiles.push(...files)
      nextPageToken = listResponse.nextPageToken
      hasMore = !!nextPageToken
    }

    // Check which files are already imported
    const fileNames = allFiles.map(f => f.name).filter(Boolean) as string[]
    
    let importedSet = new Set<string>()
    if (fileNames.length > 0) {
      const { data: existingFiles } = await supabase
        .from('interviews')
        .select('transcript_file_name')
        .in('transcript_file_name', fileNames)

      importedSet = new Set(existingFiles?.map(f => f.transcript_file_name).filter((name): name is string => name !== null) || [])
    }

    // Add imported status to each file
    const filesWithStatus = allFiles.map(file => ({
      id: file.id,
      name: file.name,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      alreadyImported: file.name ? importedSet.has(file.name) : false
    }))

    const newCount = filesWithStatus.filter(f => !f.alreadyImported).length
    const importedCount = filesWithStatus.filter(f => f.alreadyImported).length

    return NextResponse.json({ 
      files: filesWithStatus, 
      total: allFiles.length,
      newCount,
      importedCount
    })

  } catch (error) {
    return errorResponse(error, 'Drive files error')
  }
}
