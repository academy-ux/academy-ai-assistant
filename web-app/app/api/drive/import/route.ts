import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folderId } = await req.json()
    if (!folderId) return NextResponse.json({ error: 'Folder ID required' }, { status: 400 })

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token.accessToken as string })
    const drive = google.drive({ version: 'v3', auth })

    // 1. List all Google Docs in the folder
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      pageSize: 20 // Limit batch size to avoid timeout
    })

    const files = listRes.data.files || []
    const results = []

    // 2. Process each file
    for (const file of files) {
      // Check if already imported
      const { data: existing } = await supabase
        .from('interviews')
        .select('id')
        .eq('transcript_file_name', file.name)
        .single()

      if (existing) {
        results.push({ name: file.name, status: 'skipped' })
        continue
      }

      // Download text
      const exportRes = await drive.files.export({
        fileId: file.id!,
        mimeType: 'text/plain',
      })
      const text = exportRes.data as string

      if (!text || text.length < 50) {
         results.push({ name: file.name, status: 'too_short' })
         continue
      }

      // Generate Embedding
      const embedding = await generateEmbedding(text)

      // Save to Supabase
      const { error } = await supabase.from('interviews').insert({
        meeting_title: file.name,
        meeting_date: file.createdTime || new Date().toISOString(),
        transcript: text,
        transcript_file_name: file.name,
        embedding: embedding,
        summary: 'Imported from Drive',
        rating: 'Not Analyzed' 
      })

      if (error) {
         console.error('Supabase error:', error)
         results.push({ name: file.name, status: 'error' })
      } else {
         results.push({ name: file.name, status: 'imported' })
      }
    }

    return NextResponse.json({ results })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
