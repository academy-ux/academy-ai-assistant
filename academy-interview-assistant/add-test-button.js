/**
 * Adds a floating test button to Google Meet
 * Paste this into the console once, and you'll have a button to test the panel
 */

// Remove existing test button if any
const existingBtn = document.getElementById('academy-test-button');
if (existingBtn) existingBtn.remove();

// Create test button
const testButton = document.createElement('button');
testButton.id = 'academy-test-button';
testButton.textContent = '🎯 Test Panel';
testButton.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
  padding: 12px 20px;
  background: #8f917f;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
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
  showTestPanel();
});

document.body.appendChild(testButton);

console.log('[Academy] Test button added! Click it to show the candidate panel.');

// Function to show test panel
function showTestPanel() {
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

  // Remove any existing panel
  const existingPanel = document.getElementById('academy-candidate-panel');
  if (existingPanel) {
    existingPanel.remove();
    return; // Toggle off if already showing
  }

  // Create style element
  const style = document.createElement('style');
  style.id = 'academy-panel-styles';
  style.textContent = `
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
    
    #academy-candidate-panel .academy-panel-header {
      background: #8f917f;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    #academy-candidate-panel .academy-panel-title {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    #academy-candidate-panel .academy-panel-title svg {
      width: 14px;
      height: 14px;
      opacity: 0.9;
    }
    
    #academy-candidate-panel .academy-panel-close {
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
    
    #academy-candidate-panel .academy-panel-close:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.05);
    }
    
    #academy-candidate-panel .academy-candidate-info {
      padding: 16px;
    }
    
    #academy-candidate-panel .academy-candidate-name {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    
    #academy-candidate-panel .academy-candidate-position {
      font-size: 13px;
      color: #575757;
      margin-bottom: 8px;
    }
    
    #academy-candidate-panel .academy-candidate-stage {
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
    
    #academy-candidate-panel .academy-candidate-meta {
      font-size: 12px;
      color: #8a8a8a;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    #academy-candidate-panel .academy-divider {
      height: 1px;
      background: #e3e5de;
      margin: 12px 0;
    }
    
    #academy-candidate-panel .academy-links-label {
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8a8a8a;
      margin-bottom: 10px;
    }
    
    #academy-candidate-panel .academy-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    #academy-candidate-panel .academy-link {
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
    
    #academy-candidate-panel .academy-link:hover {
      background: #e3e5de;
      border-color: #cdd0c3;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(39, 39, 39, 0.08);
    }
    
    #academy-candidate-panel .academy-link-icon {
      width: 14px;
      height: 14px;
      color: #8f917f;
    }
    
    #academy-candidate-panel .academy-link-primary {
      background: #8f917f;
      border-color: #8f917f;
      color: #ffffff;
    }
    
    #academy-candidate-panel .academy-link-primary:hover {
      background: #7a7c6b;
    }
    
    #academy-candidate-panel .academy-link-primary .academy-link-icon {
      color: #ffffff;
    }
    
    #academy-candidate-panel .academy-link-accent {
      background: hsl(24, 66%, 96%);
      border-color: hsl(24, 66%, 86%);
      color: hsl(24, 50%, 35%);
    }
    
    #academy-candidate-panel .academy-link-accent:hover {
      background: hsl(24, 66%, 90%);
    }
    
    #academy-candidate-panel .academy-lever-link {
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
    
    #academy-candidate-panel .academy-lever-link:hover {
      background: #e3e5de;
      color: #575757;
    }
    
    #academy-candidate-panel .academy-lever-link svg {
      width: 14px;
      height: 14px;
      transition: transform 0.2s ease-out;
    }
    
    #academy-candidate-panel .academy-lever-link:hover svg {
      transform: translateX(2px);
    }
  `;

  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'academy-candidate-panel';

  // Create header
  const header = document.createElement('div');
  header.className = 'academy-panel-header';

  const title = document.createElement('span');
  title.className = 'academy-panel-title';
  title.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  title.appendChild(document.createTextNode(' Candidate'));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'academy-panel-close';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close';

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Create info section
  const info = document.createElement('div');
  info.className = 'academy-candidate-info';

  const candidateName = document.createElement('div');
  candidateName.className = 'academy-candidate-name';
  candidateName.textContent = mockCandidate.name;

  const position = document.createElement('div');
  position.className = 'academy-candidate-position';
  position.textContent = mockCandidate.position;

  const stage = document.createElement('div');
  stage.className = 'academy-candidate-stage';
  stage.textContent = mockCandidate.stage;

  const headline = document.createElement('div');
  headline.className = 'academy-candidate-meta';
  headline.textContent = mockCandidate.headline;

  const locationDiv = document.createElement('div');
  locationDiv.className = 'academy-candidate-meta';
  locationDiv.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  locationDiv.appendChild(document.createTextNode(' ' + mockCandidate.location));

  const divider = document.createElement('div');
  divider.className = 'academy-divider';

  const linksLabel = document.createElement('div');
  linksLabel.className = 'academy-links-label';
  linksLabel.textContent = 'Quick Links';

  const links = document.createElement('div');
  links.className = 'academy-links';

  // LinkedIn link
  const linkedinLink = document.createElement('a');
  linkedinLink.href = mockCandidate.links.linkedin;
  linkedinLink.target = '_blank';
  linkedinLink.className = 'academy-link academy-link-primary';
  linkedinLink.innerHTML = '<svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  linkedinLink.appendChild(document.createTextNode(' LinkedIn'));

  // Portfolio link
  const portfolioLink = document.createElement('a');
  portfolioLink.href = mockCandidate.links.portfolio;
  portfolioLink.target = '_blank';
  portfolioLink.className = 'academy-link academy-link-accent';
  portfolioLink.innerHTML = '<svg class="academy-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  portfolioLink.appendChild(document.createTextNode(' Portfolio'));

  // GitHub link
  const githubLink = document.createElement('a');
  githubLink.href = mockCandidate.links.github;
  githubLink.target = '_blank';
  githubLink.className = 'academy-link';
  githubLink.innerHTML = '<svg class="academy-link-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>';
  githubLink.appendChild(document.createTextNode(' GitHub'));

  // Email link
  const emailLink = document.createElement('a');
  emailLink.href = 'mailto:' + mockCandidate.email;
  emailLink.className = 'academy-link';
  emailLink.innerHTML = '<svg class="academy-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>';
  emailLink.appendChild(document.createTextNode(' Email'));

  links.appendChild(linkedinLink);
  links.appendChild(portfolioLink);
  links.appendChild(githubLink);
  links.appendChild(emailLink);

  info.appendChild(candidateName);
  info.appendChild(position);
  info.appendChild(stage);
  info.appendChild(headline);
  info.appendChild(locationDiv);
  info.appendChild(divider);
  info.appendChild(linksLabel);
  info.appendChild(links);

  // Create footer link
  const leverLink = document.createElement('a');
  leverLink.href = mockCandidate.leverUrl;
  leverLink.target = '_blank';
  leverLink.className = 'academy-lever-link';
  leverLink.textContent = 'Open in Lever ';
  leverLink.innerHTML += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(info);
  panel.appendChild(leverLink);

  // Add to page
  const existingStyle = document.getElementById('academy-panel-styles');
  if (!existingStyle) {
    document.head.appendChild(style);
  }
  document.body.appendChild(panel);

  // Close handler
  closeBtn.addEventListener('click', () => {
    panel.remove();
  });

  // Make draggable
  let isDragging = false;
  let offsetX, offsetY;

  header.style.cursor = 'move';

  header.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - offsetX) + 'px';
    panel.style.top = (e.clientY - offsetY) + 'px';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  console.log('[Academy Test] Panel shown');
}
