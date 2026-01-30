import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { errorResponse } from '@/lib/validation'

// POST: Force re-parse ALL interviews to extract metadata (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Admin-only endpoint
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email
    const isUserAdmin = isAdmin(userEmail)
    
    console.log('[reparse-all] User email:', userEmail)
    console.log('[reparse-all] Is admin:', isUserAdmin)
    console.log('[reparse-all] ADMIN_EMAILS env:', process.env.ADMIN_EMAILS)
    
    if (!isUserAdmin) {
      return NextResponse.json({ 
        error: 'Admin access required',
        debug: {
          userEmail,
          adminEmails: process.env.ADMIN_EMAILS
        }
      }, { status: 403 })
    }

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

        // Generate intelligent meeting title
        const meetingDate = interview.meeting_date 
          ? new Date(interview.meeting_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        
        let generatedTitle = metadata.meetingType || 'Meeting'
        
        // Format: "Candidate <> Interviewer — Type MM/DD/YYYY"
        if (metadata.candidateName && metadata.candidateName !== 'Unknown Candidate' && metadata.candidateName !== 'Team') {
          if (metadata.interviewer && metadata.interviewer !== 'Unknown') {
            generatedTitle = `${metadata.candidateName} <> ${metadata.interviewer} — ${metadata.meetingCategory} ${meetingDate}`
          } else {
            generatedTitle = `${metadata.candidateName} — ${metadata.meetingCategory} ${meetingDate}`
          }
        } else if (metadata.meetingCategory && metadata.meetingCategory !== 'Other') {
          generatedTitle = `${metadata.meetingCategory} ${meetingDate}`
        }

        // Update the interview with new meeting_type categorization
        const { error: updateError } = await supabase
          .from('interviews')
          .update({
            candidate_name: metadata.candidateName,
            interviewer: metadata.interviewer,
            meeting_title: generatedTitle,
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
