/**
 * Academy Interview Assistant - Content Script for Google Meet
 *
 * Simplified version: Only detects when meeting ends.
 * Transcript is fetched from Google Drive (not scraped from captions).
 */

let isInMeeting = false;
let meetingEndTriggered = false;
let meetingTitle = '';
let meetingCode = '';

// Initialize
function init() {
  console.log('[Academy] Content script initialized');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }
}

function startMonitoring() {
  detectMeetingJoin();
  watchForMeetingEnd();

  // Periodic check for meeting info
  setInterval(detectMeetingInfo, 3000);
}

function detectMeetingJoin() {
  const observer = new MutationObserver(() => {
    // Check for video elements or meeting controls that indicate active meeting
    const hasVideo = document.querySelectorAll('video').length > 0;
    const hasMeetingControls = document.querySelector('[data-is-muted]') ||
                               document.querySelector('[aria-label*="microphone"]') ||
                               document.querySelector('[aria-label*="camera"]') ||
                               document.querySelector('[aria-label*="Turn off"]');

    if ((hasVideo || hasMeetingControls) && !isInMeeting) {
      isInMeeting = true;
      console.log('[Academy] Joined meeting');
      detectMeetingInfo();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function detectMeetingInfo() {
  // Get meeting code from URL
  const urlMatch = location.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
  if (urlMatch) {
    meetingCode = urlMatch[1];
  }

  // Get meeting title from page
  const titleEl = document.querySelector('[data-meeting-title]') ||
                  document.querySelector('[data-call-title]');

  if (titleEl) {
    meetingTitle = titleEl.textContent.trim();
  } else {
    // Try page title
    const pageTitle = document.title.replace(' - Google Meet', '').trim();
    if (pageTitle && pageTitle !== 'Google Meet') {
      meetingTitle = pageTitle;
    }
  }

  if (meetingTitle || meetingCode) {
    console.log('[Academy] Meeting info:', { title: meetingTitle, code: meetingCode });
  }
}

function watchForMeetingEnd() {
  // Method 1: Watch for leave button click
  document.addEventListener('click', (e) => {
    const target = e.target;

    const leaveSelectors = [
      '[aria-label*="Leave"]',
      '[aria-label*="leave"]',
      '[data-tooltip*="Leave"]',
      '[aria-label*="End call"]',
      '[aria-label*="end call"]',
      '[jsname="CQylAd"]'
    ];

    for (const selector of leaveSelectors) {
      try {
        if (target.closest(selector)) {
          console.log('[Academy] Leave button clicked');
          // Wait a moment for the meeting to actually end
          setTimeout(() => handleMeetingEnd('leave_button'), 2000);
          return;
        }
      } catch (e) {}
    }
  });

  // Method 2: Watch for "You left the meeting" message
  const messageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = (node.textContent || '').toLowerCase();
          if (text.includes('you left the meeting') ||
              text.includes("you've left the meeting") ||
              text.includes('call ended') ||
              text.includes('meeting ended') ||
              text.includes('return to home screen')) {
            console.log('[Academy] Meeting end message detected');
            handleMeetingEnd('end_message');
            return;
          }
        }
      }
    }
  });

  messageObserver.observe(document.body, { childList: true, subtree: true });

  // Method 3: Watch for URL change away from meeting
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      const wasInMeeting = lastUrl.includes('meet.google.com/') &&
                           lastUrl.match(/\/[a-z]{3}-[a-z]{4}-[a-z]{3}/);
      const stillInMeeting = location.href.match(/\/[a-z]{3}-[a-z]{4}-[a-z]{3}/);

      if (wasInMeeting && !stillInMeeting && isInMeeting) {
        console.log('[Academy] Navigated away from meeting');
        handleMeetingEnd('navigation');
      }
      lastUrl = location.href;
    }
  }, 1000);
}

function handleMeetingEnd(trigger) {
  if (meetingEndTriggered) return;
  if (!isInMeeting) return;

  meetingEndTriggered = true;
  isInMeeting = false;

  console.log(`[Academy] Meeting ended (trigger: ${trigger})`);
  console.log('[Academy] Meeting code:', meetingCode);
  console.log('[Academy] Meeting title:', meetingTitle);

  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'meetingEnded',
    meetingCode: meetingCode,
    meetingTitle: meetingTitle,
    timestamp: Date.now()
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Academy] Error:', chrome.runtime.lastError);
    } else {
      console.log('[Academy] Background notified:', response);
    }
  });

  // Reset after delay to allow for rejoining
  setTimeout(() => {
    meetingEndTriggered = false;
  }, 10000);
}

// Start
init();
