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

  if (request.action === 'checkAuthStatus') {
    checkLoginStatus()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, authenticated: false, error: error.message }))
    return true
  }
  if (request.action === 'uploadTranscript') {
    uploadTranscript(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
})

// Upload real-time transcript to web app
async function uploadTranscript(request) {
  const webAppUrl = await getWebAppUrl()

  console.log('[Academy] 📤 Uploading transcript due to meeting end...');

  try {
    const response = await fetch(`${webAppUrl}/api/interviews/create`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcript: request.transcript,
        meetingCode: request.meetingCode,
        title: request.title
      })
    })

    if (!response.ok) {
      console.error('[Academy] Upload failed:', response.status);
      return { success: false, error: 'Upload failed' }
    }

    const data = await response.json();
    console.log('[Academy] Transcript uploaded successfully:', data.id);
    return { success: true, id: data.id }
  } catch (e) {
    console.error('[Academy] Upload error:', e);
    return { success: false, error: e.message }
  }
}

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

  // If we have an interview ID from the upload, use it to open that specific interview
  if (request.interviewId) {
    params.set('interviewId', request.interviewId)
  }

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
