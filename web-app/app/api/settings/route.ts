import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { validateBody, errorResponse } from '@/lib/validation'

const settingsSchema = z.object({
  driveFolderId: z.string().optional(),
  autoPollEnabled: z.boolean().optional(),
  pollIntervalMinutes: z.number().min(5).max(1440).optional(), // 5 min to 24 hours
  folderName: z.string().optional(),
})

// GET - Fetch user settings
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', token.email)
      .single()

    if (error) {
      // If no settings exist yet, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          driveFolderId: null,
          autoPollEnabled: false,
          pollIntervalMinutes: 15,
          lastPollTime: null,
          folderName: null,
          lastPollFileCount: 0,
        })
      }
      throw error
    }

    return NextResponse.json({
      driveFolderId: data.drive_folder_id,
      autoPollEnabled: data.auto_poll_enabled,
      pollIntervalMinutes: data.poll_interval_minutes,
      lastPollTime: data.last_poll_time,
      folderName: data.folder_name,
      lastPollFileCount: data.last_poll_file_count,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch settings')
  }
}

// POST - Update user settings
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: validationError } = await validateBody(req, settingsSchema)
    if (validationError) return validationError

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_email', token.email)
      .single()

    const settingsData: Record<string, any> = {
      user_email: token.email,
    }

    if (body.driveFolderId !== undefined) {
      settingsData.drive_folder_id = body.driveFolderId
    }
    if (body.autoPollEnabled !== undefined) {
      settingsData.auto_poll_enabled = body.autoPollEnabled
    }
    if (body.pollIntervalMinutes !== undefined) {
      settingsData.poll_interval_minutes = body.pollIntervalMinutes
    }
    if (body.folderName !== undefined) {
      settingsData.folder_name = body.folderName
    }

    if (existing) {
      // Update existing settings
      const { error } = await supabase
        .from('user_settings')
        .update(settingsData)
        .eq('user_email', token.email)

      if (error) throw error
    } else {
      // Create new settings
      const { error } = await supabase
        .from('user_settings')
        .insert(settingsData as any)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Failed to update settings')
  }
}
