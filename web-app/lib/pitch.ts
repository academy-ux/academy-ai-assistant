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

// Best-effort text of the candidate's portfolio site — one of the four sources
// recruiters draw on when writing blurbs by hand (transcript, resume,
// portfolio site, feedback notes).
async function fetchPortfolioText(links: { url: string }[] | undefined): Promise<string> {
    if (!links?.length) return ''
    const skip = /linkedin\.com|github\.com|twitter\.com|x\.com|mailto:|instagram\.com/i
    const target = links.find((l) => l.url && !skip.test(l.url))
    if (!target) return ''
    try {
        const res = await fetch(target.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AcademyAssistant/1.0)' },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok || !/text\/html/i.test(res.headers.get('content-type') || '')) return ''
        const html = await res.text()
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        return text.length > 200 ? `(from ${target.url})\n${text.slice(0, 3000)}` : ''
    } catch {
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
    links?: { url: string }[]
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

    // Gather the other blurb sources in parallel: resume-derived profile,
    // team feedback notes, and the candidate's portfolio site text.
    const [profileRes, notesRes, portfolioText] = await Promise.all([
        email
            ? supabase
                .from('candidate_profiles' as any)
                .select('current_title, current_company, years_of_experience, salary_expectations')
                .eq('candidate_email', email)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        email
            ? supabase
                .from('candidate_notes' as any)
                .select('content, created_by, source')
                .eq('candidate_email', email)
                .order('created_at', { ascending: false })
                .limit(8)
            : Promise.resolve({ data: [] }),
        fetchPortfolioText(opts.links),
    ])

    const profile: any = (profileRes as any).data
    let exp: { relevantYears?: number; totalYears?: number; summary?: string } = {}
    try {
        if (profile?.years_of_experience) exp = JSON.parse(profile.years_of_experience) || {}
    } catch { /* old non-JSON format */ }
    const resumeContext = profile
        ? [
            profile.current_title && profile.current_company
                ? `Current role: ${profile.current_title} at ${profile.current_company}`
                : profile.current_title
                    ? `Current role: ${profile.current_title}`
                    : '',
            exp.relevantYears != null ? `Relevant experience: ${exp.relevantYears} years (total ${exp.totalYears ?? '?'} years)` : '',
            exp.summary ? `Resume summary: ${exp.summary}` : '',
        ].filter(Boolean).join('\n')
        : ''

    const notesContext = (((notesRes as any).data || []) as any[])
        // internal-only notes stay out of anything that could reach a client
        .filter((n) => n.source !== 'internal' && n.content)
        .map((n) => `- ${n.source === 'client' ? '[client] ' : ''}${String(n.content).slice(0, 400)}`)
        .join('\n')

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

    const prompt = `You are a senior recruiter at Academy, a design-led recruiting firm. You are writing a candidate blurb to present a candidate to a hiring manager/client, in the style your team writes by hand.

CANDIDATE NAME: ${candidateName || 'Unknown'}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ''}${resumeContext ? `\nRESUME / BACKGROUND:\n${resumeContext}\n` : ''}${portfolioText ? `\nPORTFOLIO SITE TEXT:\n${portfolioText}\n` : ''}${notesContext ? `\nTEAM & CLIENT FEEDBACK NOTES:\n${notesContext}\n` : ''}
INTERVIEW DATA:
${transcriptContext}

TASK: Write one tight, specific blurb paragraph (5-7 sentences) presenting this candidate for this role. The blurb is EXPERIENCE-FIRST: its backbone is where this person has worked and what they built there.

STRUCTURE (follow this order):
1. Open with their concrete background — current/most recent role AND the most impressive, recognizable companies, clients, or brands in their history (scan ALL sources for these; if they've worked at or with well-known names, those MUST appear by name).
2. Then their most relevant projects: pick the 1-3 specific projects or products they mentioned (in the interview, portfolio, or resume) that align most closely with this job description's requirements, and say concretely what they did on them and how that maps to what this role needs.
3. Close with the recruiter's honest read: what makes them compelling for this role, and — if the sources reveal one — a brief, matter-of-fact note on any gap or thing worth validating.

GUIDELINES:
- Name-drop deliberately: recognizable employers, clients, and products carry the pitch — never summarize them away as "several leading companies"
- Choose projects for ALIGNMENT with the job description, not just impressiveness; make the connection explicit
- Prefer specifics over adjectives: companies, products, project types, team sizes, outcomes
- Never invent facts — only use what the sources above support
- Be confident but honest; skip generic praise like "great communicator" unless demonstrated
- Natural, professional tone as if speaking to a client
- No bullet points, one flowing paragraph
- Do NOT start with the candidate's name — the reader already knows who this is about

Return ONLY the blurb paragraph text, nothing else.`

    const result = await model.generateContent(prompt)
    return result.response.text().trim()
}
