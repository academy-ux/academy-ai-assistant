import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSearchParams, errorResponse } from '@/lib/validation'

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200), // Search query (name or email)
})

/**
 * Search for a candidate by name or email.
 * Used by the Chrome extension to find candidate info during interviews.
 */
export async function GET(request: NextRequest) {
  // Handle CORS for Chrome extension (content scripts run from meet.google.com)
  const origin = request.headers.get('origin') || ''
  const isExtension = origin.startsWith('chrome-extension://') || origin === 'https://meet.google.com'

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (isExtension) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  try {
    const leverKey = process.env.LEVER_API_KEY

    if (!leverKey) {
      return NextResponse.json(
        { error: 'Lever API key not configured' },
        { status: 500, headers }
      )
    }

    const { data: params, error: validationError } = validateSearchParams(
      request.nextUrl.searchParams,
      searchQuerySchema
    )
    if (validationError) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400, headers }
      )
    }

    const searchQuery = params.q.toLowerCase().trim()
    const isEmailSearch = searchQuery.includes('@')

    console.log('[Lever Search] Starting search for:', searchQuery, isEmailSearch ? '(email)' : '(name)')

    // Fetch opportunities with pagination
    // If searching by email, use Lever's email filter for exact match
    // Otherwise, fetch all and filter by name locally
    const allOpportunities: any[] = []
    let hasMore = true
    let offset: string | null = null
    let pageCount = 0
    // Lever API limits to 100/page, so we need more pages for larger datasets
    const MAX_PAGES = isEmailSearch ? 1 : 20 // Email search should return exact match, name search up to 2000 candidates

    // Track matches for early exit optimization
    let matchCount = 0

    while (hasMore && pageCount < MAX_PAGES) {
      const leverParams = new URLSearchParams()
      leverParams.append('limit', '100') // Lever API max is 100
      leverParams.append('expand', 'contact')
      leverParams.append('expand', 'stage')
      leverParams.append('expand', 'applications')
      leverParams.append('confidentiality', 'all') // Get both confidential AND non-confidential
      leverParams.append('archived', 'true') // Include archived opportunities

      // Use Lever's email filter for email searches (much faster!)
      if (isEmailSearch) {
        leverParams.append('email', searchQuery)
      }
      // Note: Removed created_at_start filter to search ALL candidates, not just recent ones

      if (offset) {
        leverParams.append('offset', offset)
      }

      const response = await fetch(
        `https://api.lever.co/v1/opportunities?${leverParams.toString()}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Lever API error: ${response.status}`)
      }

      const data = await response.json()
      const pageOpps = data.data || []
      allOpportunities.push(...pageOpps)

      pageCount++
      hasMore = data.hasNext || false
      offset = data.next || null

      console.log(`[Lever Search] Page ${pageCount}: Got ${pageOpps.length} opportunities (total: ${allOpportunities.length}, hasMore: ${hasMore})`)

      // Early exit for name searches if we found matches
      if (!isEmailSearch && pageOpps.length > 0) {
        // Check if this page has any matches
        const pageMatches = pageOpps.filter((opp: any) => {
          const name = (opp.name || '').toLowerCase()

          // Direct substring match
          if (name.includes(searchQuery)) return true

          // All words in query appear in name
          const queryWords = searchQuery.split(/\s+/).filter(w => w.length > 0)
          if (queryWords.every((word: string) => name.includes(word))) return true

          // First word match
          const firstQueryWord = queryWords[0]
          const firstNameWord = name.split(/\s+/)[0]
          if (firstQueryWord && firstNameWord && firstNameWord.startsWith(firstQueryWord)) return true

          return false
        })

        matchCount += pageMatches.length

        // If we found 5+ matches, stop fetching (we only return top 5 anyway)
        if (matchCount >= 5) {
          console.log(`[Lever Search] Early exit: Found ${matchCount} matches`)
          hasMore = false
        }
      }
    }

    console.log(`[Lever Search] Fetched ${allOpportunities.length} total opportunities across ${pageCount} pages${isEmailSearch ? ' (email filter)' : ''}`)
    const opportunities = allOpportunities

    // For email searches, API already filtered - all results are matches
    // For name searches, filter locally with stricter matching
    let matches: any[]
    const MIN_SCORE_THRESHOLD = 70 // Only return matches with score >= 70

    if (isEmailSearch) {
      // API already filtered by email - all results are matches (score 100)
      matches = opportunities.map(opp => {
        opp._searchScore = 100
        return opp
      })
    } else {
      // Search by name with scoring
      matches = opportunities.reduce((acc: any[], opp: any) => {
        const name = (opp.name || '').toLowerCase()
        const email = (opp.emails?.[0] || '').toLowerCase()
        let score = 0

        // Exact match (Title Case handled by lowercasing)
        if (name === searchQuery) {
          score = 100
        }
        // Exact Email match
        else if (email === searchQuery) {
          score = 95
        }
        // Name starts with query (e.g. "Adam" -> "Adam Pavlov" or "Donnacha" -> "Donnacha O'Rear")
        else if (name.startsWith(searchQuery + ' ')) {
          score = 90
        }
        // Query is contained in name as a full word
        else if (name.includes(' ' + searchQuery + ' ') || name.endsWith(' ' + searchQuery)) {
          score = 85
        }
        // All words in query appear in name as full words
        else {
          const queryWords = searchQuery.split(/\s+/).filter(w => w.length > 0)
          const nameWords = name.split(/\s+/)

          const allWordsPresent = queryWords.every((qw: string) =>
            nameWords.some((nw: string) => nw === qw || (qw.length > 2 && nw.startsWith(qw)))
          )

          if (allWordsPresent) {
            score = 70
          }
          // Note: Removed 60-point fallback - we only want strong matches (70+)
        }

        // Only include matches with score >= MIN_SCORE_THRESHOLD
        if (score >= MIN_SCORE_THRESHOLD) {
          opp._searchScore = score
          acc.push(opp)
        }
        return acc
      }, [])
    }

    console.log(`[Lever Search] Found ${matches.length} matches for query: "${searchQuery}" (min score: ${MIN_SCORE_THRESHOLD})`)
    if (matches.length > 0) {
      console.log('[Lever Search] First 3 matches:', matches.slice(0, 3).map((m: any) => `${m.name} (score: ${m._searchScore})`))
    } else {
      console.log('[Lever Search] No strong matches found (all candidates scored below 70)')
    }

    // Transform matches to include useful info
    const candidates = matches.map((opp: any) => {
      const contact = opp.contact || {}
      // ... (rest of mapping code) ...

      // Extract links (LinkedIn, portfolio, etc.)
      const rawLinks = opp.links || []
      const links: Record<string, string> = {}

      // ... (link extraction logic) ...

      for (const link of rawLinks) {
        let url: string
        if (typeof link === 'string') {
          url = link
        } else if (link && typeof link === 'object') {
          url = link.url || link.href || String(link)
        } else {
          continue
        }

        if (!url || typeof url !== 'string') continue

        if (url.includes('linkedin.com')) {
          links.linkedin = url
        } else if (url.includes('github.com')) {
          links.github = url
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
          links.twitter = url
        } else if (url.includes('dribbble.com')) {
          links.dribbble = url
        } else if (url.includes('behance.net')) {
          links.behance = url
        } else {
          if (!links.portfolio) links.portfolio = url
          else if (!links.other) links.other = url
        }
      }

      const resume = opp.resume || null
      const resumeUrl = resume?.file?.downloadUrl || null
      const roleTag = opp.tags?.[0] || ''
      const role = roleTag || opp.headline || 'No position'

      return {
        id: opp.id,
        name: opp.name || 'Unknown',
        email: opp.emails?.[0] || '',
        phone: opp.phones?.[0]?.value || '',
        headline: opp.headline || '',
        location: opp.location || '',
        position: role,
        role: role,
        stage: opp.stage?.text || 'Unknown Stage',
        links,
        allLinks: rawLinks,
        leverUrl: `https://hire.lever.co/candidates/${opp.id}`,
        resumeUrl,
        createdAt: opp.createdAt,
        _searchScore: opp._searchScore
      }
    })

    // Sort by Score first, then completeness
    candidates.sort((a: any, b: any) => {
      // 1. Search Score (descending)
      if ((a._searchScore || 0) !== (b._searchScore || 0)) {
        return (b._searchScore || 0) - (a._searchScore || 0)
      }

      // 2. Link Completeness
      const aLinkCount = Object.keys(a.links).length
      const bLinkCount = Object.keys(b.links).length
      return bLinkCount - aLinkCount
    })

    return NextResponse.json(
      {
        success: true,
        query: params.q,
        count: candidates.length,
        candidates: candidates.slice(0, 5) // Return top 5 matches
      },
      { headers }
    )

  } catch (error) {
    return errorResponse(error, 'Lever search error')
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const isExtension = origin.startsWith('chrome-extension://') || origin === 'https://meet.google.com'

  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (isExtension) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return new NextResponse(null, { status: 204, headers })
}
