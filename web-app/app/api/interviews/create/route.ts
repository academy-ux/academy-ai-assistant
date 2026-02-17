import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/embeddings'
import { parseTranscriptMetadata } from '@/lib/transcript-parser'
import { errorResponse } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/interviews/create
 * Endpoint for real-time transcript uploads from the Chrome extension.
 * Handles deduplication against existing interviews.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { transcript, meetingCode, title } = body

        if (!transcript || transcript.length < 50) {
            return NextResponse.json({ error: 'Transcript too short' }, { status: 400 })
        }

        // Identify this transcript
        // We use "drive_file_id" as a unique key for now, storing the meet code
        const uniqueId = `meet-${meetingCode}`
        const fileName = `[Realtime] ${title || 'Meeting'}`

        // 1. Check if we already have this interview (by code)
        const { data: existing } = await supabase
            .from('interviews')
            .select('id, transcript, meeting_title')
            .eq('drive_file_id', uniqueId)
            .maybeSingle()

        if (existing) {
            console.log(`[Realtime Upload] Duplicate detected (ID: ${existing.id}). Updating...`)

            // Optionally append text if it looks new? 
            // For now, let's just update the timestamp to show it was active
            await supabase
                .from('interviews')
                .update({
                    updated_at: new Date().toISOString(),
                    // Update transcript if the new one is significantly longer?
                    // transcript: transcript.length > existing.transcript.length ? transcript : existing.transcript 
                })
                .eq('id', existing.id)

            return NextResponse.json({
                success: true,
                id: existing.id,
                status: 'updated_existing'
            })
        }

        // 2. Metadata Parsing
        console.log('[Realtime Upload] Parsing metadata...')
        const metadata = await parseTranscriptMetadata(transcript, title || '')

        // 3. Generate Embedding
        console.log('[Realtime Upload] Generating embedding...')
        const embedding = await generateEmbedding(transcript)

        // 4. Construct Title (reuse logic from drive/import)
        const meetingDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        let generatedTitle = metadata.meetingType || title || 'Meeting'

        if (metadata.candidateName && metadata.candidateName !== 'Unknown Candidate') {
            generatedTitle = `${metadata.candidateName} — ${metadata.meetingCategory} ${meetingDate}`
        } else if (metadata.meetingCategory && metadata.meetingCategory !== 'Other') {
            generatedTitle = `${metadata.meetingCategory} ${meetingDate}`
        }

        // 5. Insert
        const { data: inserted, error } = await supabase
            .from('interviews')
            .insert({
                meeting_title: generatedTitle,
                meeting_type: metadata.meetingCategory,
                meeting_date: new Date().toISOString(),
                transcript: transcript,
                transcript_file_name: fileName,
                drive_file_id: uniqueId, // Used for deduplication
                embedding: embedding,
                summary: metadata.summary,
                rating: 'Not Analyzed',
                candidate_name: metadata.candidateName,
                interviewer: metadata.interviewer,
                position: metadata.position || '',
                owner_email: session.user.email // Track owner
            })
            .select()
            .single()

        if (error) throw error
        if (!inserted) throw new Error('Insert failed - no data returned')

        console.log(`[Realtime Upload] Created interview: ${inserted.id}`)

        return NextResponse.json({
            success: true,
            id: inserted.id,
            status: 'created'
        })

    } catch (error) {
        return errorResponse(error, 'Realtime upload error')
    }
}
