/**
 * Academy Interview Assistant - Background Service Worker
 *
 * Simple: Opens the web app when meeting ends
 */

// Production web app URL
const WEB_APP_URL = 'https://academy-ai-assistant.vercel.app'

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

  // Build URL with query params
  const params = new URLSearchParams()
  if (request.meetingCode) params.set('meeting', request.meetingCode)
  if (request.meetingTitle) params.set('title', request.meetingTitle)
  params.set('ts', Date.now().toString())

  const url = `${WEB_APP_URL}/feedback?${params.toString()}`

  console.log('[Academy] Opening:', url)

  // Open the web app
  const tab = await chrome.tabs.create({
    url: url,
    active: true
  })

  return { success: true, tabId: tab.id }
}
