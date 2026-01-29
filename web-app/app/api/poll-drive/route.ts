import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'
import { pollFolder } from '@/lib/drive-polling'

// Manual poll endpoint - user can trigger from UI
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.accessToken || !token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_email', token.email)
      .single()

    if (settingsError || !settings?.drive_folder_id) {
      return NextResponse.json({ 
        error: 'No Drive folder configured. Please import a folder first.' 
      }, { status: 400 })
    }

    console.log(`[Manual Poll] Polling folder for ${token.email}`)

    const result = await pollFolder(
      token.accessToken as string,
      settings.drive_folder_id,
      token.email
    )

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      totalFiles: result.imported + result.skipped + result.errors,
      lastPollTime: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Manual Poll] Error:', error)
    return NextResponse.json({ 
      error: 'Poll failed',
      message: error.message 
    }, { status: 500 })
  }
}
