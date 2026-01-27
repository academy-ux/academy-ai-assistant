/**
 * Academy Interview Assistant - Background Service Worker
 *
 * Simple: Opens the web app when meeting ends
 */

// Default web app URL (can be configured in settings)
const DEFAULT_WEB_APP_URL = 'http://localhost:3000'

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'meetingEnded') {
    handleMeetingEnded(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
})

async function handleMeetingEnded(request) {
  console.log('[Academy] Meeting ended')
  console.log('[Academy] Title:', request.meetingTitle)
  console.log('[Academy] Code:', request.meetingCode)

  // Get configured web app URL
  const settings = await chrome.storage.local.get(['webAppUrl'])
  const baseUrl = settings.webAppUrl || DEFAULT_WEB_APP_URL

  // Build URL with query params
  const params = new URLSearchParams()
  if (request.meetingCode) params.set('meeting', request.meetingCode)
  if (request.meetingTitle) params.set('title', request.meetingTitle)
  params.set('ts', Date.now().toString())

  const url = `${baseUrl}/feedback?${params.toString()}`

  console.log('[Academy] Opening:', url)

  // Open the web app
  const tab = await chrome.tabs.create({
    url: url,
    active: true
  })

  return { success: true, tabId: tab.id }
}

// Handle extension install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Academy] Extension installed')
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })
  }
})
