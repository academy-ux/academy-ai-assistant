/**
 * Academy Interview Assistant - Content Script for Google Meet
 *
 * Features:
 * - Detects when meeting ends and opens feedback form
 * - Finds candidate info from Lever and shows it in the meeting UI
 * - Transcript is fetched from Google Drive (not scraped from captions)
 */

let isInMeeting = false;
let meetingEndTriggered = false;
let meetingTitle = '';
let meetingCode = '';
let candidateInfoPanel = null;
let detectedParticipants = new Set();
let currentCandidate = null;

// Initialize
function init() {
  console.log('[Academy] Content script initialized');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }
  
  // Add test button in development/testing
  addTestButton();
}

// Add test button for easy testing
function addTestButton() {
  // Remove existing test button if any
  const existingBtn = document.getElementById('academy-test-button');
  if (existingBtn) return;

  // Create test button
  const testButton = document.createElement('button');
  testButton.id = 'academy-test-button';
  testButton.textContent = '🎯 Test Candidate Panel';
  testButton.title = 'Click to show test candidate info';
  testButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 99999;
    padding: 10px 16px;
    background: #8f917f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease-out;
  `;

  testButton.addEventListener('mouseenter', () => {
    testButton.style.background = '#7a7c6b';
    testButton.style.transform = 'translateY(-2px)';
    testButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  testButton.addEventListener('mouseleave', () => {
    testButton.style.background = '#8f917f';
    testButton.style.transform = 'translateY(0)';
    testButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  testButton.addEventListener('click', () => {
    // Toggle panel - if it exists, remove it; otherwise show it
    if (candidateInfoPanel) {
      removeCandidatePanel();
    } else {
      showTestCandidate();
    }
  });

  // Wait for body to be available
  const addButton = () => {
    if (document.body) {
      document.body.appendChild(testButton);
      console.log('[Academy] Test button added');
    } else {
      setTimeout(addButton, 100);
    }
  };
  addButton();
}

// Show test candidate with real data from Lever
async function showTestCandidate() {
  console.log('[Academy] Fetching Towsiful from Lever...');
  
  // Check if extension context is valid
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('[Academy] Extension context lost - please reload the extension');
    alert('Extension disconnected. Please reload the extension in chrome://extensions');
    return;
  }
  
  // Show loading state
  const loadingCandidate = {
    id: 'loading',
    name: 'Loading...',
    email: '',
    phone: '',
    headline: 'Fetching Towsiful from Lever',
    location: '',
    position: 'Please wait',
    stage: 'Loading',
    links: {},
    leverUrl: '#'
  };
  
  showCandidatePanel(loadingCandidate);
  
  // Search for Towsiful Chowdhury
  console.log('[Academy Content] Requesting search for Towsiful...');
  chrome.runtime.sendMessage({
    action: 'searchCandidate',
    name: 'Towsiful'
  }, (response) => {
    console.log('[Academy Content] Got response:', response);
    
    if (chrome.runtime.lastError) {
      console.error('[Academy Content] Runtime error:', chrome.runtime.lastError);
      
      // Show error state
      const errorCandidate = {
        id: 'error',
        name: 'Connection Error',
        email: '',
        headline: chrome.runtime.lastError.message || 'Could not connect to background script',
        location: '',
        position: 'Try reloading the extension',
        stage: 'Error',
        links: {},
        leverUrl: '#'
      };
      
      removeCandidatePanel();
      showCandidatePanel(errorCandidate);
      return;
    }
    
    if (response && response.success && response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log('[Academy Content] ✅ Found candidate:', candidate.name);
      removeCandidatePanel();
      showCandidatePanel(candidate);
    } else {
      console.log('[Academy Content] ❌ No candidates found. Response:', response);
      
      // Show not found state with more details
      const errorMsg = response?.error || 'Not found in Lever'
      const noCandidate = {
        id: 'none',
        name: 'Towsiful Not Found',
        email: '',
        headline: errorMsg,
        location: '',
        position: 'Check: 1) Logged into Academy? 2) Candidate exists in Lever? 3) Extension settings correct?',
        stage: 'Debug',
        links: {},
        leverUrl: 'https://hire.lever.co/'
      };
      
      removeCandidatePanel();
      showCandidatePanel(noCandidate);
    }
  });
}

function startMonitoring() {
  detectMeetingJoin();
  watchForMeetingEnd();

  // Periodic check for meeting info
  setInterval(detectMeetingInfo, 3000);
  
  // Periodic check for participants
  setInterval(detectParticipants, 5000);
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
      
      // Notify background script to check login status
      notifyMeetingJoined();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function notifyMeetingJoined() {
  console.log('[Academy] Notifying background script of meeting join...');
  
  chrome.runtime.sendMessage({
    action: 'meetingJoined',
    meetingCode: meetingCode,
    meetingTitle: meetingTitle,
    timestamp: Date.now()
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Academy] Error notifying background:', chrome.runtime.lastError);
    } else {
      console.log('[Academy] Background response:', response);
      if (response && !response.authenticated && !response.skipped) {
        console.log('[Academy] User not logged in - notification shown');
      }
    }
  });
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
  
  // Remove candidate panel
  removeCandidatePanel();
}

// ============================================
// CANDIDATE INFO DETECTION & DISPLAY
// ============================================

function detectParticipants() {
  if (!isInMeeting) return;
  
  const participants = new Set();
  
  // Method 1: Get names from video tiles
  const nameBadges = document.querySelectorAll('[data-self-name], [data-participant-id]');
  nameBadges.forEach(el => {
    const name = el.textContent?.trim();
    if (name && name.length > 1) {
      participants.add(name);
    }
  });
  
  // Method 2: Get from participant list (if open)
  const participantItems = document.querySelectorAll('[role="listitem"]');
  participantItems.forEach(item => {
    const nameEl = item.querySelector('[data-participant-id]') || 
                   item.querySelector('span');
    if (nameEl) {
      const name = nameEl.textContent?.trim();
      if (name && name.length > 1 && !name.includes('@')) {
        participants.add(name);
      }
    }
  });
  
  // Method 3: Look for names in video overlays
  const videoContainers = document.querySelectorAll('[data-requested-participant-id]');
  videoContainers.forEach(container => {
    const nameSpan = container.querySelector('span');
    if (nameSpan) {
      const name = nameSpan.textContent?.trim();
      if (name && name.length > 1) {
        participants.add(name);
      }
    }
  });
  
  // Method 4: Check meeting title for candidate name
  if (meetingTitle) {
    // Often meeting titles are like "Interview with John Smith" or "John Smith - Technical Interview"
    const titlePatterns = [
      /(?:interview|call|meeting)\s+(?:with|:)\s+(.+)/i,
      /(.+?)\s+(?:-|–|—)\s+(?:interview|call|screen)/i,
      /^(.+?)\s+(?:interview|call|screen)/i,
    ];
    
    for (const pattern of titlePatterns) {
      const match = meetingTitle.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && name.split(' ').length <= 4) {
          participants.add(name);
        }
      }
    }
  }
  
  // Check for new participants
  for (const name of participants) {
    if (!detectedParticipants.has(name) && !isLikelyTeamMember(name)) {
      detectedParticipants.add(name);
      console.log('[Academy] New participant detected:', name);
      searchAndShowCandidate(name);
    }
  }
}

// Heuristic to filter out team members (you can customize this)
function isLikelyTeamMember(name) {
  const lowerName = name.toLowerCase();
  
  // Skip "You" or presentation mode names
  if (lowerName === 'you' || lowerName === 'presentation') return true;
  
  // Skip if it looks like an email
  if (name.includes('@')) return true;
  
  // Skip meeting room names
  if (lowerName.includes('room') || lowerName.includes('conference')) return true;
  
  return false;
}

function searchAndShowCandidate(name) {
  console.log('[Academy] Searching for candidate:', name);
  
  // Check if extension context is valid
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('[Academy] Extension context lost - skipping search');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'searchCandidate',
    name: name
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Academy] Search error:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.success && response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      console.log('[Academy] Found candidate:', candidate.name);
      showCandidatePanel(candidate);
    } else {
      console.log('[Academy] No candidate found for:', name);
    }
  });
}

function showCandidatePanel(candidate) {
  // Remove existing panel if any
  removeCandidatePanel();
  
  currentCandidate = candidate;
  
  // Create the panel
  candidateInfoPanel = document.createElement('div');
  candidateInfoPanel.id = 'academy-candidate-panel';
  candidateInfoPanel.innerHTML = `
    <style>
      /* Academy Design System - Olive/Green tones with glass effect */
      #academy-candidate-panel {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 300px;
        /* Much more transparent to show background */
        background: rgba(255, 255, 255, 0.22);
        backdrop-filter: blur(40px) saturate(180%) brightness(110%);
        -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(110%);
        border-radius: 16px;
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.15),
          0 2px 16px rgba(0, 0, 0, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.5),
          inset 0 -1px 0 rgba(255, 255, 255, 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.4);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
        color: #272727;
        overflow: hidden;
        animation: 
          academyFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both,
          subtleGlow 4s ease-in-out infinite;
        -webkit-font-smoothing: antialiased;
        /* More transparent border */
        border: 1px solid rgba(255, 255, 255, 0.35);
      }
      
      @keyframes academyFadeIn {
        from {
          opacity: 0;
          transform: translateX(20px) scale(0.95);
          filter: blur(10px);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
          filter: blur(0);
        }
      }
      
      @keyframes subtleGlow {
        0%, 100% {
          box-shadow: 
            0 8px 32px rgba(39, 39, 39, 0.12),
            0 2px 8px rgba(39, 39, 39, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            0 0 0 1px rgba(181, 184, 169, 0.2);
        }
        50% {
          box-shadow: 
            0 8px 32px rgba(39, 39, 39, 0.12),
            0 2px 8px rgba(39, 39, 39, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 0 0 1px rgba(181, 184, 169, 0.3),
            0 0 20px rgba(143, 145, 127, 0.1);
        }
      }
      
      .academy-panel-header {
        /* Keep this very transparent so Meet UI shows through */
        background: linear-gradient(135deg, rgba(143, 145, 127, 0.18) 0%, rgba(122, 124, 107, 0.18) 100%);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      }
      
      .academy-panel-title {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .academy-panel-title svg {
        width: 14px;
        height: 14px;
        opacity: 0.9;
      }
      
      .academy-panel-close {
        background: rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s ease-out;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
      }
      
      .academy-panel-close:hover {
        background: rgba(255, 255, 255, 0.22);
        transform: scale(1.08);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      
      .academy-panel-close:active {
        transform: scale(0.98);
      }
      
      .academy-candidate-info {
        padding: 16px;
        position: relative;
        /* Make center content area more opaque for readability */
        background: rgba(255, 255, 255, 0.28);
        backdrop-filter: blur(20px) saturate(140%);
        -webkit-backdrop-filter: blur(20px) saturate(140%);
      }
      
      .academy-candidate-info::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1) 0%,
          rgba(255, 255, 255, 0) 50%,
          rgba(143, 145, 127, 0.03) 100%
        );
        pointer-events: none;
        z-index: 0;
      }
      
      .academy-candidate-info > * {
        position: relative;
        z-index: 1;
      }
      
      .academy-candidate-name {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: #272727;
        margin-bottom: 4px;
      }
      
      .academy-candidate-position {
        font-size: 13px;
        color: #575757;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .academy-candidate-stage {
        display: inline-block;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 4px 10px;
        background: rgba(227, 229, 222, 0.5);
        color: #575757;
        border-radius: 6px;
        margin-bottom: 12px;
      }
      
      .academy-candidate-meta {
        font-size: 12px;
        color: #8a8a8a;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .academy-candidate-meta:last-of-type {
        margin-bottom: 16px;
      }
      
      .academy-divider {
        height: 1px;
        background: linear-gradient(90deg, 
          rgba(227, 229, 222, 0) 0%,
          rgba(227, 229, 222, 0.5) 20%,
          rgba(227, 229, 222, 0.5) 80%,
          rgba(227, 229, 222, 0) 100%
        );
        margin: 12px 0;
      }
      
      .academy-links-label {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8a8a8a;
        margin-bottom: 10px;
      }
      
      .academy-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .academy-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: rgba(245, 246, 243, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(227, 229, 222, 0.5);
        border-radius: 8px;
        color: #272727;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease-out;
      }
      
      .academy-link:hover {
        background: rgba(227, 229, 222, 0.6);
        border-color: rgba(205, 208, 195, 0.7);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(39, 39, 39, 0.08);
      }
      
      .academy-link:active {
        transform: scale(0.98);
      }
      
      .academy-link-icon {
        width: 14px;
        height: 14px;
        color: #8f917f;
      }
      
      .academy-link.academy-link-primary {
        background: rgba(143, 145, 127, 0.65);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-color: rgba(143, 145, 127, 0.35);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(143, 145, 127, 0.15);
      }
      
      .academy-link.academy-link-primary:hover {
        background: rgba(122, 124, 107, 0.75);
        border-color: rgba(122, 124, 107, 0.45);
        box-shadow: 0 4px 16px rgba(143, 145, 127, 0.2);
      }
      
      .academy-link.academy-link-primary .academy-link-icon {
        color: #ffffff;
      }
      
      .academy-lever-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 16px;
        /* Keep this very transparent so Meet UI shows through */
        background: rgba(250, 250, 249, 0.18);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #ffffff;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        border-top: 1px solid rgba(227, 229, 222, 0.18);
        transition: all 0.2s ease-out;
      }
      
      .academy-lever-link:hover {
        background: rgba(227, 229, 222, 0.5);
        color: #ffffff;
      }
      
      .academy-lever-link svg {
        width: 14px;
        height: 14px;
        color: #ffffff;
        transition: transform 0.2s ease-out;
      }
      
      .academy-lever-link:hover svg {
        transform: translateX(2px);
      }
      
      /* Peach accent for special highlights */
      .academy-link.academy-link-accent {
        background: hsla(24, 66%, 96%, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-color: hsla(24, 66%, 86%, 0.5);
        color: hsl(24, 50%, 35%);
        box-shadow: 0 2px 8px hsla(24, 66%, 76%, 0.15);
      }
      
      .academy-link.academy-link-accent:hover {
        background: hsla(24, 66%, 90%, 0.65);
        border-color: hsla(24, 66%, 76%, 0.6);
        box-shadow: 0 4px 12px hsla(24, 66%, 76%, 0.2);
      }
      
      .academy-link.academy-link-accent .academy-link-icon {
        color: hsl(24, 50%, 45%);
      }
    </style>
    
    <div class="academy-panel-header">
      <span class="academy-panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Candidate
      </span>
      <button class="academy-panel-close" title="Close">✕</button>
    </div>
    
    <div class="academy-candidate-info">
      <div class="academy-candidate-name">${escapeHtml(candidate.name)}</div>
      <div class="academy-candidate-position">${escapeHtml(candidate.position)}</div>
      <div class="academy-candidate-stage">${escapeHtml(candidate.stage)}</div>
      
      ${candidate.headline ? `<div class="academy-candidate-meta">${escapeHtml(candidate.headline)}</div>` : ''}
      ${candidate.location ? `
        <div class="academy-candidate-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${escapeHtml(candidate.location)}
        </div>
      ` : ''}
      
      <div class="academy-divider"></div>
      <div class="academy-links-label">Quick Links</div>
      
      <div class="academy-links">
        ${candidate.resumeUrl ? `
          <a href="${escapeHtml(candidate.resumeUrl)}" target="_blank" class="academy-link academy-link-primary" title="View Resume">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Resume
          </a>
        ` : ''}
        
        ${candidate.links.linkedin ? `
          <a href="${escapeHtml(candidate.links.linkedin)}" target="_blank" class="academy-link" title="LinkedIn">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </a>
        ` : ''}
        
        ${candidate.links.portfolio ? `
          <a href="${escapeHtml(candidate.links.portfolio)}" target="_blank" class="academy-link academy-link-accent" title="Portfolio">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            Portfolio
          </a>
        ` : ''}
        
        ${candidate.links.github ? `
          <a href="${escapeHtml(candidate.links.github)}" target="_blank" class="academy-link" title="GitHub">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </a>
        ` : ''}
        
        ${candidate.links.dribbble ? `
          <a href="${escapeHtml(candidate.links.dribbble)}" target="_blank" class="academy-link" title="Dribbble">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.392-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.04 6.4 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.814zm-11.62-2.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.825 0-1.63.1-2.4.285zm10.335 3.483c-.218.29-1.935 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z"/>
            </svg>
            Dribbble
          </a>
        ` : ''}
        
        ${candidate.links.behance ? `
          <a href="${escapeHtml(candidate.links.behance)}" target="_blank" class="academy-link" title="Behance">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.5-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-1.16 1.35-.48.348-1.05.6-1.67.767-.61.165-1.252.254-1.91.254H0V4.51h6.938v-.007zM6.545 9.66c.548 0 .998-.14 1.357-.404.36-.263.54-.676.54-1.234 0-.31-.06-.557-.17-.75-.12-.19-.28-.348-.48-.464-.2-.117-.424-.2-.684-.248-.26-.053-.52-.077-.79-.077H3.13v3.19h3.41l.005-.013zm.22 5.39c.306 0 .59-.03.86-.085.265-.055.503-.145.71-.27.21-.124.378-.29.504-.5.12-.21.19-.477.19-.805 0-.647-.19-1.118-.573-1.418-.38-.3-.87-.45-1.49-.45H3.13v3.53h3.64l-.005-.002zm9.95-4.98c-.46-.46-1.08-.69-1.87-.69-.52 0-.96.09-1.33.27-.36.18-.66.42-.9.71-.23.3-.4.62-.51.98-.11.36-.18.72-.2 1.09h5.82c-.03-.86-.3-1.54-.76-2.02v-.01l-.26-.33zm-5.36 2.93v.27c0 .7.11 1.3.34 1.85.22.55.54 1 .94 1.37.4.38.88.66 1.43.85.56.19 1.17.28 1.84.28.97 0 1.77-.23 2.4-.68.62-.45 1.08-1.06 1.35-1.82h2.37c-.22.77-.53 1.44-.94 2.03-.42.6-.92 1.1-1.5 1.5-.6.4-1.26.7-1.98.9-.73.2-1.5.3-2.33.3-1.06 0-2.03-.17-2.9-.53-.87-.35-1.62-.86-2.24-1.52-.62-.66-1.1-1.45-1.44-2.38-.34-.93-.5-1.95-.5-3.09 0-1.08.17-2.08.5-3 .33-.92.8-1.71 1.4-2.38.61-.67 1.34-1.2 2.2-1.56.85-.37 1.8-.55 2.84-.55 1.12 0 2.11.22 2.97.66.86.44 1.58 1.02 2.15 1.76.58.74 1.01 1.59 1.29 2.55.28.96.38 1.96.32 3h-8.73l.04.05zM15.28 5.18h5.27v1.56h-5.27V5.18z"/>
            </svg>
            Behance
          </a>
        ` : ''}
        
        ${candidate.email ? `
          <a href="mailto:${escapeHtml(candidate.email)}" class="academy-link" title="Email">
            <svg class="academy-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 6l-10 7L2 6"/>
            </svg>
            Email
          </a>
        ` : ''}
      </div>
    </div>
    
    <a href="${escapeHtml(candidate.leverUrl)}" target="_blank" class="academy-lever-link">
      Open in Lever
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"/>
        <path d="M12 5l7 7-7 7"/>
      </svg>
    </a>
  `;
  
  document.body.appendChild(candidateInfoPanel);
  
  // Add close button handler
  const closeBtn = candidateInfoPanel.querySelector('.academy-panel-close');
  closeBtn.addEventListener('click', removeCandidatePanel);
  
  // Make panel draggable
  makeDraggable(candidateInfoPanel);
}

function removeCandidatePanel() {
  if (candidateInfoPanel) {
    candidateInfoPanel.remove();
    candidateInfoPanel = null;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function makeDraggable(element) {
  const header = element.querySelector('.academy-panel-header');
  let isDragging = false;
  let offsetX, offsetY;
  
  header.style.cursor = 'move';
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.academy-panel-close')) return;
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.transition = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    element.style.left = (e.clientX - offsetX) + 'px';
    element.style.top = (e.clientY - offsetY) + 'px';
    element.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    element.style.transition = '';
  });
}

// Start
init();
