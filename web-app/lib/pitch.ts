import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

/**
 * Fetch the job description from Lever for a given posting.
 */
export async function fetchJobDescription(postingId: string): Promise<string> {
    if (!postingId || postingId === '__uncategorized__') return ''

    const leverKey = process.env.LEVER_API_KEY
    if (!leverKey) return ''

    try {
        const headers = {
            'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
        }
        const postingRes = await fetch(`https://api.lever.co/v1/postings/${postingId}`, { headers })
        if (!postingRes.ok) return ''

        const postingData = await postingRes.json()
        const posting = postingData.data
        if (!posting) return ''

        const title = posting.text || ''
        const desc = posting.content?.descriptionHtml
            ? posting.content.descriptionHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
            : posting.content?.description || ''
        const lists = (posting.content?.lists || [])
            .map((l: any) => `${l.text || ''}:\n${(l.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()}`)
            .join('\n\n')
        const closing = posting.content?.closingHtml
            ? posting.content.closingHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
            : ''

        return `Job Title: ${title}\n\n${desc}\n\n${lists}\n\n${closing}`.trim()
    } catch (err) {
        console.error('[Pitch] Lever fetch error (non-fatal):', err)
        return ''
    }
}

/**
 * Generate an AI pitch paragraph for a candidate based on their interview transcripts.
 * Returns null if no transcripts are found.
 */
export async function generatePitch(opts: {
    email: string | null
    candidateName: string | null
    jobDescription?: string
}): Promise<string | null> {
    const { email, candidateName, jobDescription } = opts

    if (!email && !candidateName) return null
    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key not configured')

    // Fetch interview transcripts from Supabase
    const conditions: string[] = []
    if (email) {
        conditions.push(`candidate_name.ilike.%${email}%`)
        conditions.push(`transcript.ilike.%${email}%`)
    }
    if (candidateName) {
        conditions.push(`candidate_name.ilike.%${candidateName}%`)
    }

    const { data: interviews, error: dbError } = await supabase
        .from('interviews')
        .select('id, candidate_name, transcript, summary, meeting_title, meeting_date, position')
        .or(conditions.join(','))
        .order('meeting_date', { ascending: false })
        .limit(5)

    if (dbError) {
        console.error('[Pitch] Supabase error:', dbError)
        throw new Error('Failed to fetch interview data')
    }

    if (!interviews || interviews.length === 0) {
        return null
    }

    const transcriptContext = interviews.map((interview, i) => {
        const transcriptSnippet = interview.transcript
            ? interview.transcript.slice(0, 4000)
            : ''
        return `--- Interview ${i + 1}: ${interview.meeting_title || 'Interview'} (${interview.meeting_date ? new Date(interview.meeting_date).toLocaleDateString() : 'Unknown date'}) ---
Summary: ${interview.summary || 'No summary available'}
Transcript excerpt:
${transcriptSnippet}`
    }).join('\n\n')

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { maxOutputTokens: 4096 }
    })

    const prompt = `You are a senior recruiter at Academy, a design-led recruiting firm. You are writing a pitch paragraph to present a candidate to a hiring manager/client.

CANDIDATE NAME: ${candidateName || 'Unknown'}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ''}
INTERVIEW DATA:
${transcriptContext}

TASK: Write a compelling, specific pitch paragraph (4-6 sentences) about why this candidate is a strong fit for this role.

GUIDELINES:
- Reference SPECIFIC things the candidate said or demonstrated in the interviews — real examples, projects, skills they discussed
- If a job description is provided, connect the candidate's experience directly to the role's requirements
- Include the recruiter's assessment of the candidate's strengths based on the conversation
- Be confident but honest — avoid generic praise like "great communicator" without backing it up
- Write in a natural, professional tone as if you're speaking to a client
- Do NOT use bullet points — write it as a flowing paragraph
- Do NOT include the candidate's name at the start — the reader already knows who this is about

Return ONLY the pitch paragraph text, nothing else.`

    const result = await model.generateContent(prompt)
    return result.response.text().trim()
}
