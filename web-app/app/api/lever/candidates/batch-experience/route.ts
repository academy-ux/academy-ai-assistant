import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface ExperienceResult {
    relevantYears: number
    totalYears: number
    summary: string
}

// Process a single candidate's experience
async function analyzeCandidate(
    candidateId: string,
    candidateEmail: string | null,
    postingId: string | null,
    leverHeaders: Record<string, string>
): Promise<{ id: string; result: ExperienceResult | null }> {
    // Check cache first
    if (candidateEmail) {
        const { data: cached } = await supabase
            .from('candidate_profiles')
            .select('years_of_experience, updated_at')
            .eq('candidate_email', candidateEmail)
            .single()

        if (cached?.years_of_experience) {
            const updatedAt = new Date(cached.updated_at || 0)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            if (updatedAt > sevenDaysAgo) {
                try {
                    const parsed = JSON.parse(cached.years_of_experience)
                    if (parsed.relevantYears !== undefined) {
                        return { id: candidateId, result: parsed }
                    }
                } catch {
                    // Not JSON, re-analyze
                }
            }
        }
    }

    // Fetch resume from Lever
    const res = await fetch(`https://api.lever.co/v1/opportunities/${candidateId}/resumes`, {
        headers: leverHeaders
    })

    if (!res.ok) return { id: candidateId, result: null }

    const data = await res.json()
    const latestResume = data.data?.[0]?.parsed

    if (!latestResume?.positions?.length) {
        // Try basic calculation from positions
        let totalYears = 0
        if (latestResume?.positions) {
            let earliestDate = new Date()
            latestResume.positions.forEach((pos: any) => {
                if (pos.start?.year) {
                    const startDate = new Date(pos.start.year, (pos.start.month || 1) - 1)
                    if (startDate < earliestDate) earliestDate = startDate
                }
            })
            totalYears = new Date().getFullYear() - earliestDate.getFullYear()
        }
        return { id: candidateId, result: totalYears > 0 ? { relevantYears: totalYears, totalYears, summary: `${totalYears} years total` } : null }
    }

    if (!process.env.GEMINI_API_KEY) {
        return { id: candidateId, result: null }
    }

    // Format positions
    const positionsText = latestResume.positions.map((pos: any, i: number) => {
        const start = pos.start ? `${pos.start.month || '?'}/${pos.start.year || '?'}` : 'Unknown'
        const end = pos.end ? `${pos.end.month || '?'}/${pos.end.year || '?'}` : 'Present'
        return `${i + 1}. ${pos.title || 'Unknown Title'} at ${pos.org || 'Unknown Company'} (${start} - ${end})`
    }).join('\n')

    return { id: candidateId, result: null, positionsText } as any
}

export async function POST(request: NextRequest) {
    try {
        const { success, response: rateLimitResponse } = await checkRateLimit(request, 'ai')
        if (!success && rateLimitResponse) return rateLimitResponse

        const leverKey = process.env.LEVER_API_KEY
        if (!leverKey) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const body = await request.json()
        const { candidates: candidateList, postingId } = body as {
            candidates: { id: string; email: string | null }[]
            postingId: string | null
        }

        if (!candidateList?.length) {
            return NextResponse.json({ experience: {} })
        }

        const leverHeaders = {
            'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
        }

        // Fetch job description once for all candidates
        let jobDescription = ''
        if (postingId && postingId !== '__uncategorized__') {
            try {
                const postingRes = await fetch(`https://api.lever.co/v1/postings/${postingId}`, { headers: leverHeaders })
                if (postingRes.ok) {
                    const postingData = await postingRes.json()
                    const posting = postingData.data
                    if (posting) {
                        const title = posting.text || ''
                        const desc = posting.content?.descriptionHtml
                            ? posting.content.descriptionHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
                            : posting.content?.description || ''
                        const lists = (posting.content?.lists || [])
                            .map((l: any) => `${l.text || ''}:\n${(l.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()}`)
                            .join('\n\n')
                        jobDescription = `Job Title: ${title}\n\n${desc}\n\n${lists}`.trim()
                    }
                }
            } catch (e) {
                console.error('[Batch Experience] Lever posting fetch error:', e)
            }
        }

        const experience: Record<string, ExperienceResult | null> = {}

        // Phase 1: Check cache and fetch resumes for all candidates
        const needsAnalysis: { id: string; email: string | null; positionsText: string }[] = []

        // Process in batches of 5 to avoid hammering Lever API
        const BATCH_SIZE = 5
        for (let i = 0; i < candidateList.length; i += BATCH_SIZE) {
            const batch = candidateList.slice(i, i + BATCH_SIZE)

            const results = await Promise.allSettled(
                batch.map(async (c) => {
                    // Check cache first
                    if (c.email) {
                        const { data: cached } = await supabase
                            .from('candidate_profiles')
                            .select('years_of_experience, updated_at')
                            .eq('candidate_email', c.email)
                            .single()

                        if (cached?.years_of_experience) {
                            const updatedAt = new Date(cached.updated_at || 0)
                            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            if (updatedAt > sevenDaysAgo) {
                                try {
                                    const parsed = JSON.parse(cached.years_of_experience)
                                    if (parsed.relevantYears !== undefined) {
                                        return { id: c.id, cached: true, result: parsed }
                                    }
                                } catch { /* re-analyze */ }
                            }
                        }
                    }

                    // Fetch resume from Lever
                    const res = await fetch(`https://api.lever.co/v1/opportunities/${c.id}/resumes`, {
                        headers: leverHeaders
                    })

                    if (!res.ok) return { id: c.id, cached: false, result: null }

                    const data = await res.json()
                    const latestResume = data.data?.[0]?.parsed

                    if (!latestResume?.positions?.length) {
                        return { id: c.id, cached: false, result: null }
                    }

                    const positionsText = latestResume.positions.map((pos: any, idx: number) => {
                        const start = pos.start ? `${pos.start.month || '?'}/${pos.start.year || '?'}` : 'Unknown'
                        const end = pos.end ? `${pos.end.month || '?'}/${pos.end.year || '?'}` : 'Present'
                        return `${idx + 1}. ${pos.title || 'Unknown Title'} at ${pos.org || 'Unknown Company'} (${start} - ${end})`
                    }).join('\n')

                    return { id: c.id, email: c.email, cached: false, result: null, positionsText }
                })
            )

            results.forEach((r) => {
                if (r.status === 'fulfilled' && r.value) {
                    if (r.value.cached) {
                        experience[r.value.id] = r.value.result
                    } else if ((r.value as any).positionsText) {
                        needsAnalysis.push({
                            id: r.value.id,
                            email: (r.value as any).email || null,
                            positionsText: (r.value as any).positionsText
                        })
                    } else {
                        experience[r.value.id] = null
                    }
                }
            })
        }

        // Phase 2: Batch analyze with Gemini (send all candidates in one prompt for efficiency)
        if (needsAnalysis.length > 0 && process.env.GEMINI_API_KEY) {
            // Process in groups of 10 for Gemini
            const GEMINI_BATCH = 10
            for (let i = 0; i < needsAnalysis.length; i += GEMINI_BATCH) {
                const gemBatch = needsAnalysis.slice(i, i + GEMINI_BATCH)

                const candidatesBlock = gemBatch.map((c, idx) => {
                    return `=== CANDIDATE ${idx + 1} (ID: ${c.id}) ===\n${c.positionsText}`
                }).join('\n\n')

                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: { maxOutputTokens: 2048 }
                })

                const prompt = `Analyze each candidate's work history and calculate their years of experience.

${jobDescription ? `TARGET ROLE:\n${jobDescription}\n\n` : ''}${candidatesBlock}

For EACH candidate, return a JSON object. Return a JSON array with one object per candidate, in order:
[
  {
    "id": "candidate_id",
    "relevantYears": <number of years relevant to the target role, or total if no role specified>,
    "totalYears": <total professional years>,
    "summary": "<one sentence explanation>"
  }
]

Account for overlapping positions — don't double-count. Round to nearest integer.
Return ONLY the JSON array, no markdown or explanation.`

                try {
                    const result = await model.generateContent(prompt)
                    const responseText = result.response.text().trim()
                    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
                    const parsed: Array<{ id: string; relevantYears: number; totalYears: number; summary: string }> = JSON.parse(cleaned)

                    // Map results and cache
                    for (const entry of parsed) {
                        const exp: ExperienceResult = {
                            relevantYears: entry.relevantYears,
                            totalYears: entry.totalYears,
                            summary: entry.summary
                        }
                        experience[entry.id] = exp

                        // Cache in Supabase
                        const candidate = gemBatch.find(c => c.id === entry.id)
                        if (candidate?.email) {
                            await supabase
                                .from('candidate_profiles')
                                .upsert({
                                    candidate_email: candidate.email,
                                    years_of_experience: JSON.stringify(exp),
                                    updated_at: new Date().toISOString()
                                }, { onConflict: 'candidate_email' })
                                .select()
                        }
                    }
                } catch (e) {
                    console.error('[Batch Experience] Gemini analysis error:', e)
                    // Mark these as null
                    gemBatch.forEach(c => {
                        if (!experience[c.id]) experience[c.id] = null
                    })
                }
            }
        }

        return NextResponse.json({ experience })
    } catch (error) {
        console.error('[Batch Experience] Error:', error)
        return NextResponse.json({ error: 'Failed to analyze experience' }, { status: 500 })
    }
}
