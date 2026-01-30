import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'

// One-time fix: Set owner_email for imported transcripts
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = token.email

    console.log(`[Fix Owner] Setting owner_email for records imported by ${userEmail}`)

    // Update records that have a drive_file_id (were imported from Drive)
    // This will update all Drive-imported records, regardless of current owner_email value
    const { data, error } = await supabase
      .from('interviews')
      .update({ owner_email: userEmail })
      .not('drive_file_id', 'is', null)
      .select('id, meeting_title')

    if (error) {
      console.error('[Fix Owner] Error:', error)
      return NextResponse.json({ 
        error: 'Update failed',
        details: error.message 
      }, { status: 500 })
    }

    console.log(`[Fix Owner] Updated ${data?.length || 0} records`)

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      records: data?.map(r => r.meeting_title)
    })

  } catch (error: any) {
    console.error('[Fix Owner] Failed:', error)
    return NextResponse.json({ 
      error: 'Fix failed',
      message: error.message 
    }, { status: 500 })
  }
}
