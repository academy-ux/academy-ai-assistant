// Load existing settings on page load
document.addEventListener('DOMContentLoaded', async () => {
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
});

// Save settings on button click
document.getElementById('saveBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');

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
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      statusEl.className = 'status';
    }, 2000);
  }
}
