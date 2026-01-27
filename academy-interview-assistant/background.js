/**
 * Academy Interview Assistant - Background Service Worker
 *
 * Handles messages from content script and opens the feedback page
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openFeedbackPage') {
    handleOpenFeedbackPage(request)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('[Academy] Error opening feedback page:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

async function handleOpenFeedbackPage(request) {
  console.log('[Academy] Opening feedback page...');
  console.log('[Academy] Transcript length:', request.transcript?.length || 0);
  console.log('[Academy] Meeting title:', request.meetingTitle);
  console.log('[Academy] Attendees:', request.attendees);

  // Store transcript in local storage (too large for URL params)
  await chrome.storage.local.set({
    pendingTranscript: {
      transcript: request.transcript || '',
      meetingTitle: request.meetingTitle || 'Untitled Meeting',
      attendees: request.attendees || [],
      timestamp: request.timestamp || Date.now()
    }
  });

  // Open the feedback page in a new tab
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL('feedback-page.html'),
    active: true
  });

  console.log('[Academy] Feedback page opened in tab:', tab.id);
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Academy] Extension installed');
    // Could open settings page on first install
    // chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  } else if (details.reason === 'update') {
    console.log('[Academy] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Academy] Extension started');
});
