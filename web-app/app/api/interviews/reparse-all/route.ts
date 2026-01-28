import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { errorResponse } from '@/lib/validation'

// POST: Force re-parse ALL interviews to extract metadata
export async function POST(request: NextRequest) {
  try {
    // Fetch ALL interviews (removed limit to process all)
    const { data: interviews, error } = await supabase
      .from('interviews')
      .select('*')

    if (error) throw error

    if (!interviews || interviews.length === 0) {
      return NextResponse.json({ 
        message: 'No interviews found',
        updated: 0 
      })
    }

    let updated = 0
    const errors: string[] = []

    for (const interview of interviews) {
      try {
        // Parse metadata
        const metadata = await parseTranscriptMetadata(
          interview.transcript,
          interview.transcript_file_name || ''
        )

        // Update the interview with new meeting_type categorization
        const { error: updateError } = await supabase
          .from('interviews')
          .update({
            candidate_name: metadata.candidateName,
            interviewer: metadata.interviewer,
            meeting_title: metadata.meetingType,
            meeting_type: metadata.meetingCategory,
            summary: metadata.summary,
            position: metadata.position || interview.position,
            updated_at: new Date().toISOString()
          })
          .eq('id', interview.id)

        if (updateError) {
          errors.push(`${interview.transcript_file_name}: Update failed`)
        } else {
          updated++
        }
      } catch (err: any) {
        errors.push(`${interview.transcript_file_name}: Parse failed`)
      }
    }

    return NextResponse.json({
      message: `Updated ${updated} out of ${interviews.length} interviews`,
      updated,
      total: interviews.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    return errorResponse(error, 'Error reparsing interviews')
  }
}
