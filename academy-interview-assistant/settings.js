// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.local.get(['webAppUrl'])
  if (settings.webAppUrl) {
    document.getElementById('webAppUrl').value = settings.webAppUrl
  }
})

// Save on button click
document.getElementById('saveBtn').addEventListener('click', async () => {
  const webAppUrl = document.getElementById('webAppUrl').value.trim()
  const statusEl = document.getElementById('status')

  if (!webAppUrl) {
    statusEl.textContent = 'Please enter a URL'
    statusEl.className = 'status error'
    return
  }

  // Validate URL
  try {
    new URL(webAppUrl)
  } catch (e) {
    statusEl.textContent = 'Please enter a valid URL'
    statusEl.className = 'status error'
    return
  }

  // Remove trailing slash
  const cleanUrl = webAppUrl.replace(/\/$/, '')

  await chrome.storage.local.set({ webAppUrl: cleanUrl })

  statusEl.textContent = 'Saved!'
  statusEl.className = 'status success'

  setTimeout(() => {
    statusEl.className = 'status'
  }, 2000)
})
