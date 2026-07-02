import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { errorResponse } from '@/lib/validation'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BUCKET = 'client-logos'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

const keyOf = (team: string) => (team || '').toLowerCase().trim()
const publicUrl = (path: string) =>
  `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`

// GET is public: the shared client report (email-gated, no session) renders
// the same logos. Config contains nothing sensitive (domain + image URL).
export async function GET() {
  try {
    const { data, error } = await (supabase as any).from('client_logos').select('*')
    if (error) throw new Error(error.message)
    const map: Record<string, { domain: string | null; logoUrl: string | null }> = {}
    for (const row of data || []) {
      map[row.team_key] = {
        domain: row.domain || null,
        logoUrl: row.logo_path ? publicUrl(row.logo_path) : null,
      }
    }
    return NextResponse.json(map)
  } catch (error) {
    return errorResponse(error, 'Logos GET error')
  }
}

// PUT { team, domain } — set/clear the domain override (staff only)
export async function PUT(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { team, domain } = await req.json()
    const team_key = keyOf(String(team || ''))
    if (!team_key || team_key.length > 120) {
      return NextResponse.json({ error: 'Invalid team' }, { status: 400 })
    }
    const cleaned = String(domain || '').trim().toLowerCase().slice(0, 200) || null
    const { error } = await (supabase as any)
      .from('client_logos')
      .upsert({ team_key, domain: cleaned, updated_by: token.email, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Logos PUT error')
  }
}

// POST multipart { team, file } — upload a custom logo (staff only)
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const team_key = keyOf(String(form.get('team') || ''))
    const file = form.get('file')
    if (!team_key || team_key.length > 120 || !(file instanceof File)) {
      return NextResponse.json({ error: 'Expected team and file' }, { status: 400 })
    }
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Logo must be PNG, JPG, SVG or WebP' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Logo must be under 2MB' }, { status: 400 })
    }

    // Timestamped path busts caches on re-upload; remember the old file to clean up.
    const { data: existing } = await (supabase as any)
      .from('client_logos').select('logo_path').eq('team_key', team_key).maybeSingle()

    const safe = team_key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client'
    const path = `${safe}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: true })
    if (up.error) throw new Error(up.error.message)

    const { error } = await (supabase as any)
      .from('client_logos')
      .upsert({ team_key, logo_path: path, updated_by: token.email, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)

    if (existing?.logo_path && existing.logo_path !== path) {
      await supabase.storage.from(BUCKET).remove([existing.logo_path])
    }
    return NextResponse.json({ success: true, logoUrl: publicUrl(path) })
  } catch (error) {
    return errorResponse(error, 'Logos upload error')
  }
}

// DELETE { team } — remove the uploaded logo, falling back to domain sources (staff only)
export async function DELETE(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { team } = await req.json()
    const team_key = keyOf(String(team || ''))
    if (!team_key) return NextResponse.json({ error: 'Invalid team' }, { status: 400 })

    const { data: existing } = await (supabase as any)
      .from('client_logos').select('logo_path').eq('team_key', team_key).maybeSingle()
    const { error } = await (supabase as any)
      .from('client_logos')
      .update({ logo_path: null, updated_by: token.email, updated_at: new Date().toISOString() })
      .eq('team_key', team_key)
    if (error) throw new Error(error.message)
    if (existing?.logo_path) await supabase.storage.from(BUCKET).remove([existing.logo_path])
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Logos delete error')
  }
}
