// DOM elements
const googleAuthStatus = document.getElementById('googleAuthStatus');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const statusEl = document.getElementById('status');

// Check Google auth status on load
document.addEventListener('DOMContentLoaded', async () => {
  // Load existing settings
  await loadSettings();

  // Check Google auth status
  await checkGoogleAuth();
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'anthropicKey',
      'geminiKey',
      'leverKey',
      'leverUserId'
    ]);

    if (settings.anthropicKey) {
      document.getElementById('anthropicKey').value = settings.anthropicKey;
    }
    if (settings.geminiKey) {
      document.getElementById('geminiKey').value = settings.geminiKey;
    }
    if (settings.leverKey) {
      document.getElementById('leverKey').value = settings.leverKey;
    }
    if (settings.leverUserId) {
      document.getElementById('leverUserId').value = settings.leverUserId;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function checkGoogleAuth() {
  try {
    // Try to get token non-interactively to check if already authorized
    const response = await chrome.runtime.sendMessage({
      action: 'getAuthToken',
      interactive: false
    });

    if (response.success && response.token) {
      updateGoogleAuthUI(true);
    } else {
      updateGoogleAuthUI(false);
    }
  } catch (error) {
    console.error('Error checking Google auth:', error);
    updateGoogleAuthUI(false);
  }
}

function updateGoogleAuthUI(isConnected) {
  if (isConnected) {
    googleAuthStatus.className = 'auth-status connected';
    googleAuthStatus.innerHTML = `
      <div class="icon">✓</div>
      <div class="text">
        <div class="title">Connected</div>
        <div class="subtitle">Google Drive access enabled</div>
      </div>
    `;
    googleAuthBtn.textContent = 'Reconnect Google Account';
    googleAuthBtn.className = 'secondary';
  } else {
    googleAuthStatus.className = 'auth-status disconnected';
    googleAuthStatus.innerHTML = `
      <div class="icon">!</div>
      <div class="text">
        <div class="title">Not connected</div>
        <div class="subtitle">Connect to access Google Meet transcripts</div>
      </div>
    `;
    googleAuthBtn.textContent = 'Connect Google Account';
    googleAuthBtn.className = 'success';
  }
}

// Google Auth button click
googleAuthBtn.addEventListener('click', async () => {
  try {
    googleAuthBtn.disabled = true;
    googleAuthBtn.textContent = 'Connecting...';

    const response = await chrome.runtime.sendMessage({
      action: 'getAuthToken',
      interactive: true
    });

    if (response.success) {
      updateGoogleAuthUI(true);
      showStatus('Google account connected successfully!', 'success');
    } else {
      throw new Error(response.error || 'Failed to connect');
    }
  } catch (error) {
    console.error('Google auth error:', error);
    showStatus('Failed to connect Google account: ' + error.message, 'error');
    updateGoogleAuthUI(false);
  } finally {
    googleAuthBtn.disabled = false;
  }
});

// Save settings button click
document.getElementById('saveBtn').addEventListener('click', async () => {
  try {
    const settings = {
      anthropicKey: document.getElementById('anthropicKey').value.trim(),
      geminiKey: document.getElementById('geminiKey').value.trim(),
      leverKey: document.getElementById('leverKey').value.trim(),
      leverUserId: document.getElementById('leverUserId').value.trim()
    };

    // Validate required fields
    if (!settings.anthropicKey) {
      showStatus('Anthropic API Key is required', 'error');
      return;
    }
    if (!settings.leverKey) {
      showStatus('Lever API Key is required', 'error');
      return;
    }
    if (!settings.leverUserId) {
      showStatus('Lever User ID is required', 'error');
      return;
    }

    await chrome.storage.local.set(settings);

    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings. Please try again.', 'error');
  }
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }
}
