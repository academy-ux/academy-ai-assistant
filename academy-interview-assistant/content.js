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
let authStatus = null; // Stores { authenticated: boolean, user: { name, email, image } }

// Initialize
function init() {
  console.log('[Academy] Content script initialized');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
  } else {
    startMonitoring();
  }
  
  // Check authentication status
  checkAuthStatus();
  
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

// Check if user is logged into the web app (via background script)
async function checkAuthStatus() {
  try {
    console.log('[Academy] Checking authentication status...');
    
    // Check if extension context is valid
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('[Academy] Extension context lost - cannot check auth');
      authStatus = { authenticated: false, user: null };
      updateAuthStatusInPanel();
      return;
    }
    
    // Ask background script (it can access cookies properly)
    chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Academy] Error checking auth:', chrome.runtime.lastError);
        authStatus = { authenticated: false, user: null };
        updateAuthStatusInPanel();
        return;
      }
      
      authStatus = response;
      console.log('[Academy] Auth status:', authStatus.authenticated ? 'Logged in' : 'Not logged in');
      if (authStatus.user) {
        console.log('[Academy] User:', authStatus.user.name || authStatus.user.email);
      }
      
      // Update auth status in panel if it exists
      updateAuthStatusInPanel();
    });
  } catch (error) {
    console.error('[Academy] Failed to check auth status:', error);
    authStatus = { authenticated: false, user: null };
    updateAuthStatusInPanel();
  }
}

// Update authentication status in the candidate panel
function updateAuthStatusInPanel() {
  const container = document.getElementById('academy-auth-status-container');
  if (!container) return;

  const isAuthenticated = authStatus?.authenticated === true;
  const user = authStatus?.user;

  if (isAuthenticated && user) {
    // Logged in - show green status with user name
    container.className = 'academy-auth-status authenticated';
    container.innerHTML = `
      <svg class="academy-auth-icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="8" fill="hsl(140, 60%, 50%)"/>
        <path d="M5 8L7 10L11 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="academy-auth-info">
        <div class="academy-auth-label">Logged In</div>
        <div class="academy-auth-user">${escapeHtml(user.name || user.email || 'User')}</div>
      </div>
    `;
  } else {
    // Not logged in - show red warning with login button
    container.className = 'academy-auth-status not-authenticated';
    container.innerHTML = `
      <svg class="academy-auth-icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="white" stroke-width="2"/>
        <path d="M8 4V9" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <circle cx="8" cy="11.5" r="0.5" fill="white" stroke="white"/>
      </svg>
      <div class="academy-auth-info">
        <div class="academy-auth-label">Not Logged In</div>
        <div class="academy-auth-user">Transcripts won't be saved</div>
      </div>
      <a href="https://academy-ai-assistant.vercel.app/" target="_blank" class="academy-auth-button">
        Login
      </a>
    `;
  }
}

// Show test candidate with real data from Lever
async function showTestCandidate() {
  console.log('[Academy] Fetching Olga from Lever...');
  
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
    email: 'olga.dyakova@academyux.com',
    phone: '',
    headline: 'Fetching Olga Dyakova from Lever',
    location: '',
    position: 'Please wait',
    stage: 'Loading',
    links: {},
    leverUrl: '#'
  };
  
  showCandidatePanel(loadingCandidate);
  
  // Search for Olga using her email (much faster!)
  console.log('[Academy Content] Requesting search for Olga Dyakova (olga.dyakova@academyux.com)...');
  chrome.runtime.sendMessage({
    action: 'searchCandidate',
    name: 'Olga Dyakova',
    email: 'olga.dyakova@academyux.com'
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
        name: 'Olga Dyakova Not Found',
        email: 'olga.dyakova@academyux.com',
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
  // First, check if we're already in a meeting (e.g., page was reloaded)
  checkIfAlreadyInMeeting();
  
  detectMeetingJoin();
  watchForMeetingEnd();

  // Periodic check for meeting info
  setInterval(detectMeetingInfo, 3000);
  
  // Periodic check for participants
  setInterval(detectParticipants, 5000);
  
  // Periodic check if we're in a meeting (catches page reloads)
  setInterval(checkIfAlreadyInMeeting, 2000);
}

// Check if we're already in a meeting (handles page reload scenario)
function checkIfAlreadyInMeeting() {
  if (isInMeeting) return; // Already detected
  
  // Check URL pattern for meeting code
  const urlMatch = location.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
  if (!urlMatch) return; // Not on a meeting URL
  
  // Check for video elements or meeting controls
  const hasVideo = document.querySelectorAll('video').length > 0;
  const hasMeetingControls = document.querySelector('[data-is-muted]') ||
                             document.querySelector('[aria-label*="microphone"]') ||
                             document.querySelector('[aria-label*="camera"]') ||
                             document.querySelector('[aria-label*="Turn off"]') ||
                             document.querySelector('[aria-label*="Turn on"]');
  
  // Check for participant elements (more reliable indicator of active meeting)
  const hasParticipants = document.querySelector('[data-self-name]') ||
                          document.querySelector('[data-participant-id]') ||
                          document.querySelector('[data-requested-participant-id]');
  
  if (hasVideo || hasMeetingControls || hasParticipants) {
    isInMeeting = true;
    console.log('[Academy] Detected active meeting (page was reloaded or joined late)');
    detectMeetingInfo();
    notifyMeetingJoined();
  }
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
  
  const participants = new Map(); // Map<identifier, {name, email}>
  
  // Method 1: Get from participant list (best source for emails)
  const participantItems = document.querySelectorAll('[role="listitem"]');
  participantItems.forEach(item => {
    let name = null;
    let email = null;
    
    // Try to get name from various selectors
    const nameEl = item.querySelector('[data-participant-id]') || 
                   item.querySelector('[data-self-name]') ||
                   item.querySelector('span');
    if (nameEl) {
      const text = nameEl.textContent?.trim();
      if (text && text.length > 1) {
        // Check if it's an email or name
        if (text.includes('@')) {
          email = text;
        } else {
          name = text;
        }
      }
    }
    
    // Try to find email in title attribute (hover text)
    const emailEl = item.querySelector('[title*="@"]');
    if (emailEl) {
      const title = emailEl.getAttribute('title');
      const emailMatch = title?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        email = emailMatch[1];
      }
    }
    
    // Try to find email in adjacent text elements
    const allText = item.textContent || '';
    const emailMatch = allText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
      email = emailMatch[1];
    }
    
    // Store if we found something useful
    if (name || email) {
      const identifier = email || name;
      if (identifier) {
        participants.set(identifier, { name: name || email, email });
      }
    }
  });
  
  // Method 2: Get names from video tiles (usually no email here)
  const nameBadges = document.querySelectorAll('[data-self-name], [data-participant-id]');
  nameBadges.forEach(el => {
    const name = el.textContent?.trim();
    if (name && name.length > 1 && !name.includes('@')) {
      // Only add if we don't already have this person
      if (!participants.has(name)) {
        participants.set(name, { name, email: null });
      }
    }
    
    // Check for email in title/tooltip
    const title = el.getAttribute('title');
    if (title) {
      const emailMatch = title.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        const email = emailMatch[1];
        const identifier = email;
        participants.set(identifier, { name: name || email, email });
      }
    }
  });
  
  // Method 3: Look in video overlays
  const videoContainers = document.querySelectorAll('[data-requested-participant-id]');
  videoContainers.forEach(container => {
    const nameSpan = container.querySelector('span');
    if (nameSpan) {
      const name = nameSpan.textContent?.trim();
      if (name && name.length > 1 && !name.includes('@')) {
        if (!participants.has(name)) {
          participants.set(name, { name, email: null });
        }
      }
    }
  });
  
  // Method 4: Check meeting title for candidate name
  if (meetingTitle) {
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
          if (!participants.has(name)) {
            participants.set(name, { name, email: null });
          }
        }
      }
    }
  }
  
  // Check for new participants
  for (const [identifier, info] of participants.entries()) {
    if (!detectedParticipants.has(identifier) && !isLikelyTeamMember(info.name)) {
      detectedParticipants.add(identifier);
      console.log('[Academy] New participant detected:', info.name, info.email ? `(${info.email})` : '(no email)');
      searchAndShowCandidate(info.name, info.email);
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

function searchAndShowCandidate(name, email) {
  console.log('[Academy] Searching for candidate:', name, email ? `(${email})` : '(no email)');
  
  // Check if extension context is valid
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('[Academy] Extension context lost - skipping search');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'searchCandidate',
    name: name,
    email: email // Pass email to background script for faster search
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
      /* Academy Design System - Olive/Green tones with peach accents */
      #academy-candidate-panel {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 300px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 
          0 4px 6px -1px rgba(39, 39, 39, 0.08),
          0 10px 20px -5px rgba(39, 39, 39, 0.12),
          0 0 0 1px rgba(181, 184, 169, 0.3);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
        color: #272727;
        overflow: hidden;
        animation: academyFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        -webkit-font-smoothing: antialiased;
      }
      
      @keyframes academyFadeIn {
        from {
          opacity: 0;
          transform: translateX(20px);
          filter: blur(10px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
          filter: blur(0);
        }
      }
      
      .academy-panel-header {
        background: #8f917f;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
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
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s ease-out;
      }
      
      .academy-panel-close:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: scale(1.05);
      }
      
      .academy-panel-close:active {
        transform: scale(0.98);
      }
      
      .academy-candidate-info {
        padding: 16px;
      }
      
      .academy-candidate-name {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: #5b5b53;
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
        background: #e3e5de;
        color: #5b5b53;
        border-radius: 6px;
        margin-bottom: 12px;
      }
      
      .academy-candidate-meta {
        font-size: 12px;
        color: #5b5b53;
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
        background: #e3e5de;
        margin: 12px 0;
      }
      
      .academy-links-label {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #5b5b53;
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
        background: #f5f6f3;
        border: 1px solid #e3e5de;
        border-radius: 8px;
        color: #272727;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease-out;
      }
      
      .academy-link:hover {
        background: #e3e5de;
        border-color: #cdd0c3;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(39, 39, 39, 0.08);
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
        background: #8f917f;
        border-color: #8f917f;
        color: #ffffff;
      }
      
      .academy-link.academy-link-primary:hover {
        background: #7a7c6b;
        border-color: #7a7c6b;
      }
      
      .academy-link.academy-link-primary .academy-link-icon {
        color: #ffffff;
      }
      
      .academy-link.academy-link-accent {
        background: hsl(24, 66%, 96%);
        border-color: hsl(24, 66%, 86%);
        color: hsl(24, 50%, 35%);
      }
      
      .academy-link.academy-link-accent:hover {
        background: hsl(24, 66%, 90%);
        border-color: hsl(24, 66%, 76%);
      }
      
      .academy-link.academy-link-accent .academy-link-icon {
        color: hsl(24, 50%, 45%);
      }
      
      .academy-lever-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 16px;
        background: linear-gradient(to bottom, #fafaf9, #f5f6f3);
        color: #8f917f;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        border-top: 1px solid #e3e5de;
        transition: all 0.2s ease-out;
      }
      
      .academy-lever-link:hover {
        background: #e3e5de;
        color: #575757;
      }
      
      .academy-lever-link svg {
        width: 14px;
        height: 14px;
        transition: transform 0.2s ease-out;
      }
      
      .academy-lever-link:hover svg {
        transform: translateX(2px);
      }
      
      /* Auth status section */
      .academy-auth-status {
        padding: 14px 18px;
        background: linear-gradient(to bottom, #f5f6f3, #e8eae3);
        border-top: 1px solid #d4d7cc;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      
      .academy-auth-status.authenticated {
        background: rgba(220, 252, 231, 0.65);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        border-top-color: rgba(34, 197, 94, 0.4);
      }
      
      .academy-auth-status.not-authenticated {
        background: rgba(239, 68, 68, 0.75);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        border-top-color: rgba(239, 68, 68, 0.5);
      }
      
      .academy-auth-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      
      .academy-auth-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      
      .academy-auth-label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .academy-auth-status.authenticated .academy-auth-label {
        color: #15803d;
      }
      
      .academy-auth-status.not-authenticated .academy-auth-label {
        color: #ffffff;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      
      .academy-auth-user {
        font-size: 12px;
        font-weight: 500;
        color: #272727;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .academy-auth-status.not-authenticated .academy-auth-user {
        color: rgba(255, 255, 255, 0.95);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      
      .academy-auth-button {
        padding: 8px 16px;
        background: #dc2626;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s ease-out;
        text-decoration: none;
        display: inline-block;
        box-shadow: 0 2px 6px rgba(220, 38, 38, 0.2);
      }
      
      .academy-auth-button:hover {
        background: #b91c1c;
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(220, 38, 38, 0.3);
      }
      
      .academy-auth-button:active {
        transform: scale(0.98);
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
    
    <div id="academy-auth-status-container" class="academy-auth-status not-authenticated">
      <svg class="academy-auth-icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#ef4444" stroke-width="2"/>
        <path d="M8 4V9" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
        <circle cx="8" cy="11.5" r="0.5" fill="#ef4444" stroke="#ef4444"/>
      </svg>
      <div class="academy-auth-info">
        <div class="academy-auth-label">Not Logged In</div>
        <div class="academy-auth-user" style="font-size: 10px; color: #8a8a8a;">Loading...</div>
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
  
  // Update auth status in panel
  updateAuthStatusInPanel();
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
