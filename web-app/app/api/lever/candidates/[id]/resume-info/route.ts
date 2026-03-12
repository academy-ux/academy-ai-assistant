import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface ExperienceResult {
    relevantYears: number
    totalYears: number
    summary: string
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const leverKey = process.env.LEVER_API_KEY
        if (!leverKey) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const id = params.id
        const postingId = request.nextUrl.searchParams.get('postingId')
        const candidateEmail = request.nextUrl.searchParams.get('email')

        // Check Supabase cache first
        if (candidateEmail) {
            const { data: cached } = await supabase
                .from('candidate_profiles')
                .select('years_of_experience, updated_at')
                .eq('candidate_email', candidateEmail)
                .single()

            if (cached?.years_of_experience) {
                // Check if cache is fresh (< 7 days)
                const updatedAt = new Date(cached.updated_at || 0)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                if (updatedAt > sevenDaysAgo) {
                    try {
                        const parsed = JSON.parse(cached.years_of_experience)
                        if (parsed.relevantYears !== undefined) {
                            return NextResponse.json({
                                years: `${parsed.relevantYears}`,
                                totalYears: parsed.totalYears,
                                relevantYears: parsed.relevantYears,
                                summary: parsed.summary,
                                cached: true
                            })
                        }
                    } catch {
                        // Not JSON — old format, re-analyze
                    }
                }
            }
        }

        // Fetch parsed resume from Lever
        const headers = {
            'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
        }

        const res = await fetch(`https://api.lever.co/v1/opportunities/${id}/resumes`, { headers })

        if (!res.ok) {
            return NextResponse.json({ years: null })
        }

        const data = await res.json()
        // Lever uses 'parsedData' not 'parsed'
        const latestResume = data.data?.[0]?.parsedData

        if (!latestResume) {
            return NextResponse.json({ years: null })
        }

        // Calculate basic total years as fallback
        let fallbackTotalYears = 0
        if (latestResume.positions && Array.isArray(latestResume.positions)) {
            let earliestDate = new Date()
            latestResume.positions.forEach((pos: any) => {
                if (pos.start && pos.start.year) {
                    const startDate = new Date(pos.start.year, (pos.start.month || 1) - 1)
                    if (startDate < earliestDate) earliestDate = startDate
                }
            })
            fallbackTotalYears = new Date().getFullYear() - earliestDate.getFullYear()
        }

        // If no Gemini key or no positions, return basic calculation
        if (!process.env.GEMINI_API_KEY || !latestResume.positions?.length) {
            return NextResponse.json({
                years: fallbackTotalYears > 0 ? `${fallbackTotalYears}+` : null,
                totalYears: fallbackTotalYears,
                relevantYears: null,
                summary: null
            })
        }

        // Fetch job description if we have a postingId
        let jobDescription = ''
        if (postingId && postingId !== '__uncategorized__') {
            try {
                const postingRes = await fetch(`https://api.lever.co/v1/postings/${postingId}`, { headers })
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
                console.error('[Resume Info] Lever posting fetch error (non-fatal):', e)
            }
        }

        // Format positions for the prompt
        const positionsText = latestResume.positions.map((pos: any, i: number) => {
            const start = pos.start ? `${pos.start.month || '?'}/${pos.start.year || '?'}` : 'Unknown'
            const end = pos.end?.year ? `${pos.end.month || '?'}/${pos.end.year}` : 'Present'
            return `${i + 1}. ${pos.title || 'Unknown Title'} at ${pos.org || 'Unknown Company'} (${start} - ${end})\n   ${pos.summary || ''}`
        }).join('\n')

        // Use Gemini to analyze relevant experience
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { maxOutputTokens: 1024 }
        })

        const prompt = `Analyze this candidate's work history and calculate their years of experience.

${jobDescription ? `TARGET ROLE:\n${jobDescription}\n\n` : ''}WORK HISTORY:
${positionsText}

Return a JSON object with exactly these fields:
- "relevantYears": number of years of experience directly relevant to the target role (or total professional years if no target role provided). Round to nearest integer. Account for overlapping positions — don't double-count.
- "totalYears": total years of professional experience from first position to now. Round to nearest integer.
- "summary": one sentence explaining the experience breakdown (e.g., "5 years in UX design roles, 8 years total including marketing positions")

Return ONLY the JSON object, no markdown or explanation.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim()

        let experience: ExperienceResult
        try {
            // Strip markdown code fences if present
            const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
            experience = JSON.parse(cleaned)
        } catch {
            console.error('[Resume Info] Failed to parse Gemini response:', responseText)
            experience = {
                relevantYears: fallbackTotalYears,
                totalYears: fallbackTotalYears,
                summary: `${fallbackTotalYears} years total experience`
            }
        }

        // Cache in Supabase
        if (candidateEmail) {
            const cacheValue = JSON.stringify({
                relevantYears: experience.relevantYears,
                totalYears: experience.totalYears,
                summary: experience.summary
            })

            await supabase
                .from('candidate_profiles')
                .upsert({
                    candidate_email: candidateEmail,
                    years_of_experience: cacheValue,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'candidate_email' })
                .select()
        }

        return NextResponse.json({
            years: `${experience.relevantYears}`,
            totalYears: experience.totalYears,
            relevantYears: experience.relevantYears,
            summary: experience.summary,
            cached: false
        })
    } catch (error) {
        console.error('Error fetching resume info:', error)
        return NextResponse.json({ years: null })
    }
}
