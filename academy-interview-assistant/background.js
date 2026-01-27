/**
 * Academy Interview Assistant - Background Service Worker
 *
 * Handles:
 * 1. Google OAuth for Drive API access
 * 2. Fetching transcripts from Google Drive
 * 3. Opening feedback page with transcript data
 */

// Configuration
const TRANSCRIPT_WAIT_TIME = 90000; // 90 seconds for Google to process transcript
const TRANSCRIPT_SEARCH_WINDOW = 10 * 60 * 1000; // Look for transcripts from last 10 minutes

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'meetingEnded') {
    handleMeetingEnded(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }

  if (request.action === 'getAuthToken') {
    getAuthToken(request.interactive !== false)
      .then(token => sendResponse({ success: true, token }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'fetchTranscript') {
    fetchLatestTranscript(request.meetingTitle, request.meetingCode)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleMeetingEnded(request) {
  console.log('[Academy] Meeting ended, waiting for transcript...');
  console.log('[Academy] Meeting:', request.meetingTitle || request.meetingCode);

  // Store meeting info for the feedback page
  await chrome.storage.local.set({
    pendingMeeting: {
      meetingCode: request.meetingCode,
      meetingTitle: request.meetingTitle,
      timestamp: request.timestamp,
      status: 'waiting_for_transcript'
    }
  });

  // Open feedback page immediately - it will show a waiting state
  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL('feedback-page.html'),
    active: true
  });

  console.log('[Academy] Feedback page opened, tab:', tab.id);

  return { success: true, tabId: tab.id };
}

async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[Academy] Auth error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (token) {
        resolve(token);
      } else {
        reject(new Error('No token received'));
      }
    });
  });
}

async function fetchLatestTranscript(meetingTitle, meetingCode) {
  console.log('[Academy] Fetching transcript from Google Drive...');

  // Get auth token
  const token = await getAuthToken(false);

  // Search for recent transcript files
  // Google Meet transcripts are typically named like "Meeting transcript - [title] - [date]"
  // They're stored as Google Docs in the user's Drive

  const searchQueries = [
    `name contains 'transcript' and mimeType = 'application/vnd.google-apps.document'`,
    `name contains 'Transcript' and mimeType = 'application/vnd.google-apps.document'`,
  ];

  // Add meeting-specific search if we have title or code
  if (meetingTitle) {
    searchQueries.unshift(`name contains '${meetingTitle.replace(/'/g, "\\'")}' and name contains 'transcript'`);
  }
  if (meetingCode) {
    searchQueries.unshift(`name contains '${meetingCode}' and name contains 'transcript'`);
  }

  let transcriptFile = null;
  const cutoffTime = new Date(Date.now() - TRANSCRIPT_SEARCH_WINDOW).toISOString();

  for (const query of searchQueries) {
    try {
      const fullQuery = `${query} and modifiedTime > '${cutoffTime}' and trashed = false`;

      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fullQuery)}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,modifiedTime,mimeType)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!searchResponse.ok) {
        console.warn('[Academy] Search failed:', await searchResponse.text());
        continue;
      }

      const searchData = await searchResponse.json();

      if (searchData.files && searchData.files.length > 0) {
        // Get the most recent transcript
        transcriptFile = searchData.files[0];
        console.log('[Academy] Found transcript:', transcriptFile.name);
        break;
      }
    } catch (error) {
      console.warn('[Academy] Search error:', error);
    }
  }

  if (!transcriptFile) {
    return {
      success: false,
      error: 'No transcript found. Make sure Google Meet transcription is enabled.'
    };
  }

  // Fetch the document content
  // For Google Docs, we need to export as plain text
  const exportResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${transcriptFile.id}/export?mimeType=text/plain`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!exportResponse.ok) {
    throw new Error(`Failed to export transcript: ${exportResponse.status}`);
  }

  const transcriptText = await exportResponse.text();

  console.log('[Academy] Transcript fetched, length:', transcriptText.length);

  return {
    success: true,
    transcript: transcriptText,
    fileName: transcriptFile.name,
    fileId: transcriptFile.id,
    modifiedTime: transcriptFile.modifiedTime
  };
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Academy] Extension installed');
    // Open settings page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  } else if (details.reason === 'update') {
    console.log('[Academy] Extension updated to v' + chrome.runtime.getManifest().version);
  }
});
