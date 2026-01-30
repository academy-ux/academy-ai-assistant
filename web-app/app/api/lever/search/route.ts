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
    const MAX_PAGES = isEmailSearch ? 1 : 10 // Email search should return exact match, name search limited to 1000 candidates

    // For name searches, we need to search candidates created in the last 6 months
    // This is because the Lever API doesn't return results in a predictable order without date filters
    const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000) // 180 days ago
    
    // Track matches for early exit optimization
    let matchCount = 0
    
    while (hasMore && pageCount < MAX_PAGES) {
      const leverParams = new URLSearchParams()
      leverParams.append('limit', '100') // Lever API max is 100
      leverParams.append('expand', 'contact')
      leverParams.append('expand', 'stage')
      leverParams.append('expand', 'applications')
      leverParams.append('confidentiality', 'all') // Get both confidential AND non-confidential
      
      // Use Lever's email filter for email searches (much faster!)
      if (isEmailSearch) {
        leverParams.append('email', searchQuery)
      } else {
        // For name searches, filter to recent candidates to ensure predictable results
        leverParams.append('created_at_start', sixMonthsAgo.toString())
      }
      
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
    // For name searches, filter locally with fuzzy matching
    let matches: any[]
    
    if (isEmailSearch) {
      // API already filtered by email - all results are matches
      matches = opportunities
    } else {
      // Search by name (fuzzy match with multiple strategies)
      matches = opportunities.filter((opp: any) => {
        const name = (opp.name || '').toLowerCase()
        const email = (opp.emails?.[0] || '').toLowerCase()
        
        // Strategy 1: Direct substring match
        if (name.includes(searchQuery) || email.includes(searchQuery)) {
          return true
        }
        
        // Strategy 2: All words in query appear in name (in any order)
        const queryWords = searchQuery.split(/\s+/).filter(w => w.length > 0)
        if (queryWords.every((word: string) => name.includes(word))) {
          return true
        }
        
        // Strategy 3: First word of query matches first word of name (for partial searches like "Tows")
        const firstQueryWord = queryWords[0]
        const firstNameWord = name.split(/\s+/)[0]
        if (firstQueryWord && firstNameWord && firstNameWord.startsWith(firstQueryWord)) {
          return true
        }
        
        return false
      })
    }

    console.log(`[Lever Search] Found ${matches.length} matches for query: "${searchQuery}"`)
    if (matches.length > 0) {
      console.log('[Lever Search] First 3 matches:', matches.slice(0, 3).map((m: any) => m.name))
    } else {
      // Log some sample names to help debug
      console.log('[Lever Search] No matches. Sample names from DB:', opportunities.slice(0, 10).map((o: any) => o.name))
    }

    // Transform matches to include useful info
    const candidates = matches.map((opp: any) => {
      const contact = opp.contact || {}
      const app = opp.applications?.[0]
      
      // IMPORTANT: Links are on the OPPORTUNITY object, not contact!
      const rawLinks = opp.links || []
      
      // Debug: Log the raw links data
      if (rawLinks.length > 0) {
        console.log('[Lever Search] Raw links for', opp.name, ':', JSON.stringify(rawLinks))
      }
      
      // Extract links (LinkedIn, portfolio, etc.)
      const links: Record<string, string> = {}
      for (const link of rawLinks) {
        // Lever stores links as either strings or objects with url property
        let url: string
        if (typeof link === 'string') {
          url = link
        } else if (link && typeof link === 'object') {
          // Link could be { url: "...", type: "..." } or just have a url property
          url = link.url || link.href || String(link)
        } else {
          continue
        }
        
        // Skip if no valid URL
        if (!url || typeof url !== 'string') continue
        
        // Categorize by URL pattern
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
          // Assume it's a portfolio or personal site
          if (!links.portfolio) {
            links.portfolio = url
          } else if (!links.other) {
            links.other = url
          }
        }
      }

      // Debug: Log extracted links
      if (Object.keys(links).length > 0) {
        console.log('[Lever Search] ✓ Extracted links for', opp.name, ':', links)
      } else if (rawLinks.length > 0) {
        console.log('[Lever Search] ⚠️  Had raw links but extracted none for', opp.name)
      }
      
      // Get resume from resumes endpoint (the resume field on opp is deprecated)
      // For now we'll use what's available on the opportunity
      const resume = opp.resume || null
      const resumeUrl = resume?.file?.downloadUrl || null
      
      // Extract role from tags - first tag typically contains the role/posting title
      // Format is usually: "Role Title @ Company (Type)" or just "Role Title"
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
        role: role, // Also include as 'role' for clarity
        stage: opp.stage?.text || 'Unknown Stage',
        links,
        allLinks: rawLinks,
        leverUrl: `https://hire.lever.co/candidates/${opp.id}`,
        resumeUrl,
        createdAt: opp.createdAt,
      }
    })

    // Sort by relevance and completeness
    candidates.sort((a: any, b: any) => {
      // Exact name match first
      const aExact = a.name.toLowerCase() === searchQuery
      const bExact = b.name.toLowerCase() === searchQuery
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      
      // Then by number of links (more complete profiles first)
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
