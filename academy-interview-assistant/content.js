/**
 * Academy Interview Assistant - Content Script for Google Meet
 *
 * This script runs on meet.google.com pages and:
 * 1. Monitors captions/transcript during the meeting
 * 2. Detects when the meeting ends
 * 3. Sends the transcript to the background script to open the feedback page
 */

// State management
let transcriptChunks = [];
let meetingTitle = '';
let attendees = [];
let captionObserver = null;
let isInMeeting = false;
let lastCaptionText = '';
let meetingEndTriggered = false;

// Initialize when page loads
function init() {
  console.log('[Academy] Content script initialized');

  // Wait for the page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }
}

function startMonitoring() {
  // Detect when user joins the meeting
  detectMeetingJoin();

  // Start watching for captions
  watchForCaptions();

  // Watch for meeting end
  watchForMeetingEnd();

  // Periodic check for meeting info
  setInterval(detectMeetingInfo, 5000);
}

function detectMeetingJoin() {
  // Watch for elements that indicate we're in an active meeting
  const meetingObserver = new MutationObserver(() => {
    // Check for video elements or meeting controls
    const videoElements = document.querySelectorAll('video');
    const meetingControls = document.querySelector('[data-is-muted]') ||
                           document.querySelector('[aria-label*="microphone"]') ||
                           document.querySelector('[aria-label*="camera"]');

    if ((videoElements.length > 0 || meetingControls) && !isInMeeting) {
      isInMeeting = true;
      console.log('[Academy] Joined meeting');
      detectMeetingInfo();
    }
  });

  meetingObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function detectMeetingInfo() {
  // Get meeting title from various possible locations
  const titleSelectors = [
    '[data-meeting-title]',
    '[data-call-title]',
    'h1',
    '[role="heading"]',
    '[data-meeting-code]'
  ];

  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      const newTitle = el.textContent.trim();
      if (newTitle && newTitle !== meetingTitle) {
        meetingTitle = newTitle;
        console.log('[Academy] Meeting title:', meetingTitle);
      }
      break;
    }
  }

  // Try to get from page title
  if (!meetingTitle || meetingTitle === 'Meet') {
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.includes('Google Meet')) {
      meetingTitle = pageTitle.replace(' - Google Meet', '').trim();
    }
  }

  // Get attendees from participant list
  const participantSelectors = [
    '[data-participant-id]',
    '[data-requested-participant-id]',
    '[role="listitem"]'
  ];

  const newAttendees = new Set();

  for (const selector of participantSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      // Try different ways to get the name
      const nameEl = el.querySelector('[data-self-name]') ||
                    el.querySelector('[data-requested-participant-name]') ||
                    el.querySelector('[data-tooltip]') ||
                    el;

      const name = nameEl?.textContent?.trim() ||
                  nameEl?.getAttribute('data-tooltip') ||
                  nameEl?.getAttribute('aria-label');

      if (name && name.length > 1 && name.length < 100) {
        newAttendees.add(name);
      }
    });
  }

  if (newAttendees.size > 0) {
    attendees = Array.from(newAttendees);
    console.log('[Academy] Attendees:', attendees);
  }
}

function watchForCaptions() {
  // Caption selectors - Google Meet uses various elements for captions
  const captionSelectors = [
    '.a4cQT',                           // Main caption text container
    '[jsname="tgaKEf"]',                // Caption component
    '[jsname="Ng1Atb"]',                // Alternative caption element
    '[aria-live="polite"]',             // Live region for captions
    '.CNusmb',                          // Caption wrapper
    '[data-is-caption="true"]',         // Caption data attribute
    '.VbkSUe',                          // Another caption class
    '.TBMuR'                            // Caption text class
  ];

  // Create mutation observer for captions
  captionObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      // Check added nodes
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const captionText = extractCaptionText(node, captionSelectors);
          if (captionText) {
            addCaptionChunk(captionText);
          }
        }
      });

      // Also check for text content changes
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        if (target.nodeType === Node.ELEMENT_NODE || target.parentElement) {
          const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
          const captionText = extractCaptionText(element, captionSelectors);
          if (captionText) {
            addCaptionChunk(captionText);
          }
        }
      }
    });
  });

  // Observe the entire document for caption elements
  captionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log('[Academy] Caption monitoring started');
}

function extractCaptionText(element, selectors) {
  if (!element || !element.querySelector) return null;

  for (const selector of selectors) {
    try {
      // Check if element matches selector
      if (element.matches && element.matches(selector)) {
        return element.textContent?.trim();
      }

      // Check children
      const captionEl = element.querySelector(selector);
      if (captionEl) {
        return captionEl.textContent?.trim();
      }
    } catch (e) {
      // Ignore selector errors
    }
  }

  // Also check for elements with specific class patterns
  const allElements = element.querySelectorAll ? element.querySelectorAll('*') : [];
  for (const el of allElements) {
    const className = el.className || '';
    // Google Meet caption classes often contain these patterns
    if (typeof className === 'string' &&
        (className.includes('caption') ||
         className.includes('Caption') ||
         className.includes('subtitle'))) {
      const text = el.textContent?.trim();
      if (text && text.length > 0) {
        return text;
      }
    }
  }

  return null;
}

function addCaptionChunk(text) {
  if (!text || text === lastCaptionText) return;

  // Avoid very short fragments that are likely partial updates
  if (text.length < 3) return;

  // Check if this is just an extension of the last caption
  if (lastCaptionText && text.startsWith(lastCaptionText)) {
    // Update the last chunk instead of adding a new one
    if (transcriptChunks.length > 0) {
      transcriptChunks[transcriptChunks.length - 1] = {
        timestamp: Date.now(),
        text: text
      };
    }
  } else if (!lastCaptionText || !text.includes(lastCaptionText.slice(-20))) {
    // This is new text, add it
    transcriptChunks.push({
      timestamp: Date.now(),
      text: text
    });
    console.log('[Academy] Caption captured:', text.substring(0, 50) + '...');
  }

  lastCaptionText = text;
}

function watchForMeetingEnd() {
  // Method 1: Watch for leave button click
  document.addEventListener('click', (e) => {
    const target = e.target;

    // Check various leave button patterns
    const leaveIndicators = [
      '[aria-label*="Leave"]',
      '[aria-label*="leave"]',
      '[data-tooltip*="Leave"]',
      '[data-tooltip*="leave"]',
      '[aria-label*="End"]',
      '[aria-label*="end call"]',
      '[jsname="CQylAd"]'  // Leave call button jsname
    ];

    for (const selector of leaveIndicators) {
      try {
        if (target.closest(selector)) {
          console.log('[Academy] Leave button clicked');
          setTimeout(() => handleMeetingEnd(), 1500);
          return;
        }
      } catch (e) {
        // Ignore
      }
    }
  });

  // Method 2: Watch for URL change (navigating away from meeting)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // If we've left the meeting room
      if (isInMeeting && !currentUrl.includes('meet.google.com/')) {
        console.log('[Academy] Navigated away from meeting');
        handleMeetingEnd();
      }
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });

  // Method 3: Watch for "You left the meeting" or similar messages
  const endMessageObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent?.toLowerCase() || '';
          if (text.includes('you left the meeting') ||
              text.includes('call ended') ||
              text.includes('meeting ended') ||
              text.includes('you\'ve left')) {
            console.log('[Academy] Meeting end message detected');
            handleMeetingEnd();
          }
        }
      });
    });
  });

  endMessageObserver.observe(document.body, { childList: true, subtree: true });

  // Method 4: Watch for page unload
  window.addEventListener('beforeunload', () => {
    if (isInMeeting && transcriptChunks.length > 0) {
      // Store transcript before page unloads
      storeTranscriptForLater();
    }
  });

  // Method 5: Visibility change (tab closed or navigated)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isInMeeting) {
      storeTranscriptForLater();
    }
  });
}

function storeTranscriptForLater() {
  if (transcriptChunks.length === 0) return;

  const cleanedTranscript = buildTranscript();

  // Store in local storage for recovery
  chrome.storage.local.set({
    pendingTranscript: {
      transcript: cleanedTranscript,
      meetingTitle: meetingTitle || 'Untitled Meeting',
      attendees: attendees,
      timestamp: Date.now()
    }
  });
}

function handleMeetingEnd() {
  // Prevent multiple triggers
  if (meetingEndTriggered) return;
  meetingEndTriggered = true;

  console.log('[Academy] Handling meeting end...');
  console.log('[Academy] Total caption chunks:', transcriptChunks.length);

  if (transcriptChunks.length === 0) {
    console.log('[Academy] No transcript captured');
    // Still open feedback page but with empty transcript
    // User can manually paste if needed
  }

  // Build the transcript
  const fullTranscript = buildTranscript();

  console.log('[Academy] Transcript length:', fullTranscript.length);

  // Send to background script
  chrome.runtime.sendMessage({
    action: 'openFeedbackPage',
    transcript: fullTranscript,
    meetingTitle: meetingTitle || 'Untitled Meeting',
    attendees: attendees,
    timestamp: Date.now()
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Academy] Error sending message:', chrome.runtime.lastError);
    } else {
      console.log('[Academy] Feedback page opened');
    }
  });

  // Clean up
  if (captionObserver) {
    captionObserver.disconnect();
  }
  transcriptChunks = [];
  isInMeeting = false;

  // Reset trigger after a delay to allow for new meetings
  setTimeout(() => {
    meetingEndTriggered = false;
  }, 5000);
}

function buildTranscript() {
  if (transcriptChunks.length === 0) return '';

  // Combine transcript chunks
  const rawText = transcriptChunks
    .map(chunk => chunk.text)
    .join(' ');

  // Clean up the transcript
  return cleanTranscript(rawText);
}

function cleanTranscript(text) {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Remove duplicate consecutive phrases (captions often repeat)
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  const unique = [];

  sentences.forEach(sentence => {
    const normalized = sentence.trim().toLowerCase();
    // Allow sentences that are similar but not exact duplicates
    if (normalized && normalized.length > 5) {
      const key = normalized.substring(0, Math.min(normalized.length, 50));
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(sentence.trim());
      }
    } else if (normalized) {
      unique.push(sentence.trim());
    }
  });

  return unique.join(' ');
}

// Start the extension
init();
