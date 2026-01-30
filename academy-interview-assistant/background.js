/**
 * Academy Interview Assistant - Background Service Worker
 *
 * Features:
 * - Opens the web app when meeting ends
 * - Checks if user is logged in when meeting starts
 * - Shows notification if not logged in
 * - Searches Lever for candidate info during meetings
 */

// Production web app URL
const DEFAULT_WEB_APP_URL = 'https://academy-ai-assistant.vercel.app'

// Track login check state per tab
const loginCheckState = new Map()

// Cache candidate search results
const candidateCache = new Map()

// Get the configured web app URL
async function getWebAppUrl() {
  try {
    const settings = await chrome.storage.local.get(['webAppUrl'])
    return settings.webAppUrl || DEFAULT_WEB_APP_URL
  } catch (e) {
    return DEFAULT_WEB_APP_URL
  }
}

// Check if user is logged into the web app
async function checkLoginStatus() {
  const webAppUrl = await getWebAppUrl()
  
  try {
    const response = await fetch(`${webAppUrl}/api/auth/check`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.log('[Academy] Auth check failed:', response.status)
      return { authenticated: false, error: 'Request failed' }
    }
    
    const data = await response.json()
    console.log('[Academy] Auth status:', data.authenticated ? 'logged in' : 'not logged in')
    return data
  } catch (error) {
    console.error('[Academy] Error checking login:', error)
    return { authenticated: false, error: error.message }
  }
}

// Show notification that user needs to log in
async function showLoginNotification() {
  const webAppUrl = await getWebAppUrl()
  
  // Create notification
  chrome.notifications.create('login-required', {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Academy: Login Required',
    message: 'Please log in to save your interview transcript. Click to open Academy.',
    priority: 2,
    requireInteraction: true
  })
}

// Handle notification click
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId === 'login-required') {
    const webAppUrl = await getWebAppUrl()
    chrome.tabs.create({ url: webAppUrl, active: true })
    chrome.notifications.clear(notificationId)
  }
})

// Search for candidate in Lever
async function searchCandidate(name, email) {
  // Prioritize email search (much faster!)
  const searchQuery = email || name
  
  if (!searchQuery || searchQuery.length < 2) {
    return { success: false, error: 'Search query too short' }
  }
  
  // Check cache first
  const cacheKey = searchQuery.toLowerCase().trim()
  if (candidateCache.has(cacheKey)) {
    const cached = candidateCache.get(cacheKey)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      console.log('[Academy] Using cached candidate info for:', searchQuery)
      return cached.data
    }
  }
  
  const webAppUrl = await getWebAppUrl()
  
  console.log('[Academy] 🔍 Searching for:', email ? `${email} (email)` : `${name} (name)`)
  console.log('[Academy] 🌐 Using URL:', webAppUrl)
  
  try {
    const searchUrl = `${webAppUrl}/api/lever/search?q=${encodeURIComponent(searchQuery)}`
    console.log('[Academy] 📡 Full URL:', searchUrl)
    
    const response = await fetch(
      searchUrl,
      {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
    console.log('[Academy] 📥 Response status:', response.status)
    
    if (!response.ok) {
      console.error('[Academy] ❌ Lever search failed:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('[Academy] Error details:', errorText)
      return { success: false, error: `Search failed: ${response.status}` }
    }
    
    const data = await response.json()
    console.log('[Academy] ✅ Search response:', data)
    console.log('[Academy] 📊 Found', data.count, 'candidates')
    
    if (data.candidates && data.candidates.length > 0) {
      console.log('[Academy] 👤 First candidate:', data.candidates[0].name)
    }
    
    // Cache the result
    candidateCache.set(cacheKey, { data, timestamp: Date.now() })
    
    return data
  } catch (error) {
    console.error('[Academy] 💥 Error searching candidate:', error)
    return { success: false, error: error.message }
  }
}

// Get a random candidate from Lever with complete profile (LinkedIn, email, portfolio)
async function getRandomCandidate() {
  const webAppUrl = await getWebAppUrl()
  
  try {
    // First, get all candidates
    const response = await fetch(
      `${webAppUrl}/api/lever/candidates`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
    if (!response.ok) {
      console.log('[Academy] Failed to fetch candidates:', response.status)
      return { success: false, error: 'Failed to fetch candidates' }
    }
    
    const data = await response.json()
    
    if (!data.success || !data.candidates || data.candidates.length === 0) {
      console.log('[Academy] No candidates found')
      return { success: false, error: 'No candidates found' }
    }
    
    console.log('[Academy] Found', data.candidates.length, 'candidates, searching for ones with complete profiles...')
    
    // Try to find candidates with complete profiles
    const candidatesWithDetails = []
    
    // Check up to 50 random candidates to find ones with links (increased from 20)
    const candidatesToCheck = Math.min(50, data.candidates.length)
    const checkedIndices = new Set()
    
    for (let i = 0; i < candidatesToCheck; i++) {
      // Pick a random candidate we haven't checked yet
      let randomIndex
      do {
        randomIndex = Math.floor(Math.random() * data.candidates.length)
      } while (checkedIndices.has(randomIndex))
      
      checkedIndices.add(randomIndex)
      const candidate = data.candidates[randomIndex]
      
      // Search for this candidate to get full details with links
      const searchResult = await searchCandidate(candidate.name)
      
      if (searchResult.success && searchResult.candidates && searchResult.candidates.length > 0) {
        const fullCandidate = searchResult.candidates[0]
        
        // Calculate completeness score
        let score = 0
        const hasResume = !!fullCandidate.resumeUrl
        const hasLinkedIn = !!fullCandidate.links?.linkedin
        const hasPortfolio = !!fullCandidate.links?.portfolio
        const hasGitHub = !!fullCandidate.links?.github
        const hasEmail = !!fullCandidate.email
        
        if (hasResume) score += 4       // Resume is most important
        if (hasLinkedIn) score += 3     // LinkedIn is important
        if (hasPortfolio) score += 2    // Portfolio is great
        if (hasEmail) score += 1
        if (hasGitHub) score += 1
        
        // STRICT FILTER: Must have at least ONE of: resume, LinkedIn, or portfolio
        const meetsRequirements = hasResume || hasLinkedIn || hasPortfolio
        
        if (meetsRequirements) {
          candidatesWithDetails.push({ candidate: fullCandidate, score })
          const features = []
          if (hasResume) features.push('resume')
          if (hasLinkedIn) features.push('LinkedIn')
          if (hasPortfolio) features.push('portfolio')
          if (hasGitHub) features.push('GitHub')
          console.log('[Academy] ✓ Candidate:', fullCandidate.name, 'score:', score, 'has:', features.join(', '))
        } else {
          console.log('[Academy] ✗ Skipping:', fullCandidate.name, '(no resume/LinkedIn/portfolio)')
        }
      }
      
      // Stop early if we found 5 good candidates
      if (candidatesWithDetails.length >= 5) break
    }
    
    // If we found candidates with links, pick the best one
    if (candidatesWithDetails.length > 0) {
      // Sort by score (highest first) and pick randomly from top candidates
      candidatesWithDetails.sort((a, b) => b.score - a.score)
      
      // Pick randomly from top 3 or all if less than 3
      const topCandidates = candidatesWithDetails.slice(0, Math.min(3, candidatesWithDetails.length))
      const randomPick = topCandidates[Math.floor(Math.random() * topCandidates.length)]
      
      console.log('[Academy] Selected candidate:', randomPick.candidate.name, 'with score:', randomPick.score)
      return { success: true, candidate: randomPick.candidate }
    }
    
    // No candidates with complete profiles found
    console.log('[Academy] No candidates found with LinkedIn, portfolio, or resume')
    return {
      success: false,
      error: 'No candidates found with complete profiles. Please ensure candidates in Lever have LinkedIn, portfolio, or resume links.'
    }
  } catch (error) {
    console.error('[Academy] Error getting random candidate:', error)
    return { success: false, error: error.message }
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id
  
  if (request.action === 'meetingJoined') {
    handleMeetingJoined(tabId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
  
  if (request.action === 'meetingEnded') {
    handleMeetingEnded(request, tabId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
  
  if (request.action === 'searchCandidate') {
    searchCandidate(request.name, request.email)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
      return true
  }
  
  if (request.action === 'getRandomCandidate') {
    getRandomCandidate()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
  
  if (request.action === 'checkAuthStatus') {
    checkLoginStatus()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, authenticated: false, error: error.message }))
    return true
  }
})

async function handleMeetingJoined(tabId) {
  console.log('[Academy] Meeting joined, checking login status...')
  
  // Avoid checking too frequently for the same tab
  const lastCheck = loginCheckState.get(tabId)
  const now = Date.now()
  if (lastCheck && (now - lastCheck) < 60000) {
    console.log('[Academy] Skipping login check (checked recently)')
    return { success: true, skipped: true }
  }
  
  loginCheckState.set(tabId, now)
  
  const status = await checkLoginStatus()
  
  if (!status.authenticated) {
    console.log('[Academy] User not logged in, showing notification')
    await showLoginNotification()
    return { success: true, authenticated: false }
  }
  
  console.log('[Academy] User is logged in as:', status.user?.email)
  return { success: true, authenticated: true, user: status.user }
}

async function handleMeetingEnded(request, tabId) {
  console.log('[Academy] Meeting ended')
  console.log('[Academy] Title:', request.meetingTitle)
  console.log('[Academy] Code:', request.meetingCode)
  
  // Clean up login check state
  if (tabId) {
    loginCheckState.delete(tabId)
  }
  
  const webAppUrl = await getWebAppUrl()
  
  // Build URL with query params
  const params = new URLSearchParams()
  if (request.meetingCode) params.set('meeting', request.meetingCode)
  if (request.meetingTitle) params.set('title', request.meetingTitle)
  params.set('ts', Date.now().toString())

  const url = `${webAppUrl}/feedback?${params.toString()}`

  console.log('[Academy] Opening:', url)

  // Open the web app immediately
  const tab = await chrome.tabs.create({
    url: url,
    active: true
  })

  return { success: true, tabId: tab.id }
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  loginCheckState.delete(tabId)
})
