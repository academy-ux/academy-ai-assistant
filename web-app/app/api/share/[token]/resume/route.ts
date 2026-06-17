import { NextRequest, NextResponse } from 'next/server'
import { resolveShareCandidate, requestHasShareAccess } from '@/lib/share'
import { errorResponse } from '@/lib/validation'

function leverHeaders() {
  const leverKey = process.env.LEVER_API_KEY || ''
  return {
    Authorization: `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
  }
}

// Pick the most recent resume that actually has an uploaded file.
function pickResume(resumes: any[]): any | null {
  const withFile = (resumes || []).filter(r => r?.file)
  if (!withFile.length) return null
  withFile.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return withFile[0]
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'resume'
}

/**
 * GET /api/share/[token]/resume?candidateId=xxx[&download=1]
 * Without download: returns { available, filename } so the UI can decide whether
 * to show a Resume pill. With download=1: streams the file as an attachment.
 *
 * The resume lives behind Lever's authenticated API, so we proxy it here using
 * the server-side LEVER_API_KEY — the client never sees Lever credentials.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const candidateId = request.nextUrl.searchParams.get('candidateId')
    const download = request.nextUrl.searchParams.get('download')

    if (!candidateId) {
      return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
    }
    if (!process.env.LEVER_API_KEY) {
      return NextResponse.json({ available: false })
    }

    const resolved = await resolveShareCandidate(token, candidateId)
    if (!resolved) {
      return NextResponse.json({ error: 'Share link not found or has been deactivated' }, { status: 404 })
    }
    if (!requestHasShareAccess(request, token, resolved.share)) {
      return NextResponse.json({ error: 'This report is restricted', requiresEmail: true }, { status: 401 })
    }

    // Fetch the candidate's resumes from Lever.
    const listRes = await fetch(`https://api.lever.co/v1/opportunities/${candidateId}/resumes`, {
      headers: leverHeaders(),
    })
    if (!listRes.ok) {
      return NextResponse.json({ available: false })
    }
    const listData = await listRes.json()
    const resume = pickResume(listData.data || [])

    if (!resume) {
      return NextResponse.json({ available: false })
    }

    const ext = resume.file?.ext ? String(resume.file.ext).replace(/^\./, '') : 'pdf'
    const baseName = resume.file?.name || `${resolved.candidate.name} Resume`
    const filename = safeFilename(baseName.endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`)

    // Metadata-only request — just report availability.
    if (!download) {
      return NextResponse.json({ available: true, filename })
    }

    // Stream the actual file. Prefer the file's downloadUrl, fall back to the
    // documented per-resume download endpoint.
    const downloadUrl =
      resume.file?.downloadUrl ||
      `https://api.lever.co/v1/opportunities/${candidateId}/resumes/${resume.id}/download`

    const fileRes = await fetch(downloadUrl, { headers: leverHeaders() })
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Resume is unavailable' }, { status: 404 })
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'
    const buffer = await fileRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, 'Share resume error')
  }
}
