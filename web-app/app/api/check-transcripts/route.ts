import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'

// Debug: Check what transcripts exist and their owner_email values
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = token.email

    // Get all transcripts with drive_file_id (imported from Drive)
    const { data: driveImports, error } = await supabase
      .from('interviews')
      .select('id, meeting_title, owner_email, drive_file_id, created_at')
      .not('drive_file_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check what the History page query would return
    const { data: myRecords, error: myError } = await supabase
      .from('interviews')
      .select('id, meeting_title, owner_email')
      .or(`owner_email.eq.${userEmail},owner_email.is.null`)
      .order('meeting_date', { ascending: false })
      .limit(20)

    if (myError) {
      return NextResponse.json({ error: myError.message }, { status: 500 })
    }

    return NextResponse.json({
      yourEmail: userEmail,
      totalDriveImports: driveImports?.length || 0,
      visibleInHistory: myRecords?.length || 0,
      driveImports: driveImports?.map(r => ({
        title: r.meeting_title,
        owner: r.owner_email || 'NULL',
        isYours: r.owner_email === userEmail || !r.owner_email,
        driveId: r.drive_file_id
      }))
    })

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
