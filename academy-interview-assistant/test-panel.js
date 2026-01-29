/**
 * Test script to manually show the candidate panel
 * 
 * Usage:
 * 1. Open Google Meet
 * 2. Open DevTools Console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 */

// Mock candidate data
const mockCandidate = {
  id: 'test-123',
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '555-0123',
  headline: 'Senior Product Designer',
  location: 'San Francisco, CA',
  position: 'Product Designer',
  stage: 'Technical Interview',
  links: {
    linkedin: 'https://linkedin.com/in/janesmith',
    portfolio: 'https://janesmith.com',
    github: 'https://github.com/janesmith'
  },
  leverUrl: 'https://hire.lever.co/candidates/test-123',
  createdAt: new Date().toISOString()
};

// Function to escape HTML (copied from content.js)
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Function to make panel draggable
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

// Remove any existing panel
const existingPanel = document.getElementById('academy-candidate-panel');
if (existingPanel) {
  existingPanel.remove();
}

// Create and show the panel
const candidate = mockCandidate;
const panel = document.createElement('div');
panel.id = 'academy-candidate-panel';
panel.innerHTML = `
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
      background: #e3e5de;
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
      background: #e3e5de;
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
    
    /* Peach accent for special highlights */
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
      ${candidate.links.linkedin ? `
        <a href="${escapeHtml(candidate.links.linkedin)}" target="_blank" class="academy-link academy-link-primary" title="LinkedIn">
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

document.body.appendChild(panel);

// Add close button handler
const closeBtn = panel.querySelector('.academy-panel-close');
closeBtn.addEventListener('click', () => panel.remove());

// Make panel draggable
makeDraggable(panel);

// Check auth status
checkAuthStatus();

console.log('[Academy Test] Panel shown with mock data');

// Function to check authentication status
async function checkAuthStatus() {
  try {
    const API_BASE = 'https://academy-ai-assistant.vercel.app';
    const response = await fetch(`${API_BASE}/api/auth/check`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Auth check failed: ${response.status}`);
    }

    const data = await response.json();
    updateAuthStatus(data);
  } catch (error) {
    console.error('[Academy] Failed to check auth status:', error);
    updateAuthStatus({ authenticated: false, user: null });
  }
}

// Function to update auth status UI
function updateAuthStatus(authData) {
  const container = document.getElementById('academy-auth-status-container');
  if (!container) return;

  const isAuthenticated = authData?.authenticated === true;
  const user = authData?.user;

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
    console.log('[Academy] Auth: Logged in as', user.name || user.email);
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
    console.log('[Academy] Auth: Not logged in');
  }
}
