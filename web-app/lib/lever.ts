/**
 * Shared Lever API fetching functions.
 * Used by both internal authenticated routes and public share routes.
 */

export interface LeverCandidate {
  id: string
  name: string
  headline: string
  location: string
  email: string
  links: { url: string; type?: string }[]
  position: string
  postingId: string | null
  stage: string
  createdAt: number
  isUncategorized: boolean
  archivedAt: number | null
  archivedReason: string | null
  answers: any[]
}

/**
 * Fix common candidate link mistakes:
 * - linkedin.com/username → linkedin.com/in/username
 * - Missing https://
 */
function normalizeLink(link: string | { url: string; type?: string }): { url: string; type?: string } {
  if (typeof link === 'string') {
    link = { url: link }
  }
  if (!link.url) return link
  let url = link.url.trim()

  // Ensure protocol
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  try {
    const parsed = new URL(url)

    // Fix LinkedIn URLs: linkedin.com/username → linkedin.com/in/username
    if (parsed.hostname.includes('linkedin.com')) {
      const path = parsed.pathname.replace(/\/+$/, '') // trim trailing slashes
      const segments = path.split('/').filter(Boolean)

      // If it's just linkedin.com/username (single segment, not a known prefix)
      if (segments.length === 1) {
        const knownPrefixes = ['in', 'pub', 'company', 'school', 'groups', 'jobs', 'feed', 'messaging', 'notifications']
        if (!knownPrefixes.includes(segments[0])) {
          parsed.pathname = `/in/${segments[0]}`
          url = parsed.toString()
        }
      }
    }
  } catch {
    // If URL is unparseable, return as-is
  }

  return { ...link, url }
}

function getLeverAuth(): string {
  const leverKey = process.env.LEVER_API_KEY
  if (!leverKey) throw new Error('Lever API key not configured')
  return `Basic ${Buffer.from(leverKey + ':').toString('base64')}`
}

export async function fetchCandidatesForPosting(postingId?: string): Promise<LeverCandidate[]> {
  const auth = getLeverAuth()

  let allOpportunities: any[] = []
  let nextCursor: string | undefined = undefined
  let hasMore = true
  let pageCount = 0
  const MAX_PAGES = postingId && postingId !== '__uncategorized__' ? 20 : 3

  const baseParams = new URLSearchParams()
  baseParams.append('limit', '100')
  baseParams.append('expand', 'contact')
  baseParams.append('expand', 'stage')
  baseParams.append('expand', 'applications')
  baseParams.append('confidentiality', 'all')

  if (postingId && postingId !== '__uncategorized__') {
    baseParams.append('posting_id', postingId)
  }

  while (hasMore && pageCount < MAX_PAGES) {
    const currentParams = new URLSearchParams(baseParams)
    if (nextCursor) {
      currentParams.append('offset', nextCursor)
    }

    const url = `https://api.lever.co/v1/opportunities?${currentParams.toString()}`
    const response = await fetch(url, {
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()
    allOpportunities = [...allOpportunities, ...(data.data || [])]

    if (data.hasNext && data.next) {
      nextCursor = data.next
      pageCount++
    } else {
      hasMore = false
    }
  }

  let candidates: LeverCandidate[] = allOpportunities.map((opp: any) => {
    const app = opp.applications?.[0]

    let matchedApp = app
    if (postingId && postingId !== '__uncategorized__' && opp.applications) {
      matchedApp = opp.applications.find((a: any) => a.posting === postingId) || app
    }

    const hasPosting = !!(matchedApp?.posting && matchedApp?.postingTitle)

    const rawLocation = opp.location || opp.contact?.location || ''
    const locationText = typeof rawLocation === 'object' && rawLocation !== null
      ? (rawLocation.name || '')
      : String(rawLocation || '')

    return {
      id: opp.id,
      name: opp.contact?.name || 'Unknown',
      headline: opp.headline || opp.contact?.headline || '',
      location: locationText,
      email: opp.contact?.emails?.[0] || '',
      links: (opp.links || []).map(normalizeLink),
      position: matchedApp?.postingTitle || 'Uncategorized',
      postingId: matchedApp?.posting || null,
      stage: opp.stage?.text || 'Unknown Stage',
      createdAt: opp.createdAt,
      isUncategorized: !hasPosting,
      archivedAt: opp.archivedAt || null,
      archivedReason: opp.archivedReason || null,
      answers: matchedApp?.answers || []
    }
  })

  if (postingId === '__uncategorized__') {
    candidates = candidates.filter(c => c.isUncategorized)
  } else if (postingId) {
    candidates = candidates.filter(c => c.postingId === postingId)
  }

  return candidates
}

export async function fetchStages(): Promise<{ id: string; text: string }[]> {
  const auth = getLeverAuth()

  const response = await fetch('https://api.lever.co/v1/stages', {
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Lever API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data.map((s: any) => ({
    id: s.id,
    text: s.text
  }))
}
