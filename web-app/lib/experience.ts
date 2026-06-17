import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ExperienceResult {
  relevantYears: number
  totalYears: number
  summary: string
}

export interface ExperienceCandidate {
  id: string
  email: string | null
}

function leverHeaders() {
  const leverKey = process.env.LEVER_API_KEY || ''
  return {
    Authorization: `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  }
}

async function fetchJobDescription(postingId: string | null, headers: Record<string, string>): Promise<string> {
  if (!postingId || postingId === '__uncategorized__') return ''
  try {
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
    return `Job Title: ${title}\n\n${desc}\n\n${lists}`.trim()
  } catch (e) {
    console.error('[Experience] Lever posting fetch error:', e)
    return ''
  }
}

/**
 * Compute (and cache) years-of-experience for a set of candidates. Cached
 * results (<7 days old) are reused; the rest are fetched from Lever, analyzed
 * with Gemini, and written back to candidate_profiles so the result persists.
 *
 * Shared by the internal batch-experience route and the public share report,
 * so the shared report can populate experience on first load without an
 * authenticated user ever having opened the internal report.
 */
export async function computeExperience(
  candidateList: ExperienceCandidate[],
  postingId: string | null
): Promise<Record<string, ExperienceResult | null>> {
  const experience: Record<string, ExperienceResult | null> = {}
  if (!candidateList?.length) return experience
  if (!process.env.LEVER_API_KEY) return experience

  const headers = leverHeaders()
  const jobDescription = await fetchJobDescription(postingId, headers)

  // Phase 1: cache check + resume fetch.
  const needsAnalysis: { id: string; email: string | null; positionsText: string }[] = []
  const BATCH_SIZE = 5
  for (let i = 0; i < candidateList.length; i += BATCH_SIZE) {
    const batch = candidateList.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (c) => {
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
                  return { id: c.id, cached: true, result: parsed as ExperienceResult }
                }
              } catch { /* re-analyze */ }
            }
          }
        }

        const res = await fetch(`https://api.lever.co/v1/opportunities/${c.id}/resumes`, { headers })
        if (!res.ok) return { id: c.id, cached: false, result: null }

        const data = await res.json()
        const latestResume = data.data?.[0]?.parsedData
        if (!latestResume?.positions?.length) {
          return { id: c.id, cached: false, result: null }
        }

        const positionsText = latestResume.positions.map((pos: any, idx: number) => {
          const start = pos.start ? `${pos.start.month || '?'}/${pos.start.year || '?'}` : 'Unknown'
          const end = pos.end?.year ? `${pos.end.month || '?'}/${pos.end.year}` : 'Present'
          return `${idx + 1}. ${pos.title || 'Unknown Title'} at ${pos.org || 'Unknown Company'} (${start} - ${end})`
        }).join('\n')

        return { id: c.id, email: c.email, cached: false, result: null, positionsText }
      })
    )

    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        if ((r.value as any).cached) {
          experience[r.value.id] = (r.value as any).result
        } else if ((r.value as any).positionsText) {
          needsAnalysis.push({
            id: r.value.id,
            email: (r.value as any).email || null,
            positionsText: (r.value as any).positionsText,
          })
        } else {
          experience[r.value.id] = null
        }
      }
    })
  }

  // Phase 2: Gemini analysis for the uncached candidates.
  if (needsAnalysis.length > 0 && process.env.GEMINI_API_KEY) {
    const GEMINI_BATCH = 10
    for (let i = 0; i < needsAnalysis.length; i += GEMINI_BATCH) {
      const gemBatch = needsAnalysis.slice(i, i + GEMINI_BATCH)
      const candidatesBlock = gemBatch.map((c, idx) => `=== CANDIDATE ${idx + 1} (ID: ${c.id}) ===\n${c.positionsText}`).join('\n\n')

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { maxOutputTokens: 2048 },
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

        for (const entry of parsed) {
          const exp: ExperienceResult = {
            relevantYears: entry.relevantYears,
            totalYears: entry.totalYears,
            summary: entry.summary,
          }
          experience[entry.id] = exp

          const candidate = gemBatch.find(c => c.id === entry.id)
          if (candidate?.email) {
            await supabase
              .from('candidate_profiles')
              .upsert({
                candidate_email: candidate.email,
                years_of_experience: JSON.stringify(exp),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'candidate_email' })
              .select()
          }
        }
      } catch (e) {
        console.error('[Experience] Gemini analysis error:', e)
        gemBatch.forEach(c => { if (!experience[c.id]) experience[c.id] = null })
      }
    }
  }

  return experience
}
