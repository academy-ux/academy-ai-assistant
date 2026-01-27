# Academy Interview Assistant - Setup Guide

## Prerequisites

- Google Chrome browser
- Google Workspace account with Google Meet transcription enabled
- Anthropic API key
- Lever API key and User ID

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Name it something like "Academy Interview Assistant"

## Step 2: Enable Google Drive API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (if using Google Workspace) or **External**
3. Fill in required fields:
   - App name: "Academy Interview Assistant"
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. On Scopes page, click **Add or Remove Scopes**
6. Add: `https://www.googleapis.com/auth/drive.readonly`
7. Click **Save and Continue**
8. Complete the setup

## Step 4: Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Chrome Extension** as application type
4. Name: "Academy Interview Assistant"
5. For **Item ID**, you'll need the extension ID (see Step 5 first)

## Step 5: Get Extension ID

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `academy-interview-assistant` folder
5. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

## Step 6: Complete OAuth Setup

1. Go back to Google Cloud Console
2. Paste the Extension ID into the OAuth client setup
3. Click **Create**
4. Copy the **Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)

## Step 7: Update Extension Configuration

1. Open `manifest.json` in the extension folder
2. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
3. Remove or replace the `"key"` field (optional, for consistent extension ID)

```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  }
}
```

## Step 8: Reload Extension

1. Go to `chrome://extensions`
2. Click the refresh icon on your extension
3. Click the extension icon in toolbar
4. Click **Connect Google Account** and authorize

## Step 9: Configure API Keys

In the extension popup:

1. **Anthropic API Key**: Get from [console.anthropic.com](https://console.anthropic.com/)
2. **Lever API Key**: Get from Lever Settings → Integrations → API
3. **Lever User ID**: Your Lever user UUID (found in Lever admin or API)
4. **Gemini API Key** (optional): Get from [aistudio.google.com](https://aistudio.google.com/)

Click **Save Settings**

## Usage

1. Join a Google Meet call
2. When prompted, enable Gemini transcription
3. Conduct your interview
4. When you leave the meeting, a new tab will automatically open
5. Wait ~30-90 seconds for the transcript to be fetched from Google Drive
6. Review and edit the AI-generated feedback
7. Select the candidate and feedback template
8. Click **Submit to Lever**

## Troubleshooting

### "No transcript found"
- Make sure you enabled transcription in the Google Meet
- Wait a bit longer - transcripts can take 1-2 minutes to appear in Drive
- Check your Google Drive for recent transcript files

### "Google account not connected"
- Click the extension icon
- Click "Connect Google Account"
- Make sure you authorize the Drive read permission

### "OAuth error"
- Verify your Client ID is correct in manifest.json
- Make sure the extension ID matches what's in Google Cloud Console
- Check that Drive API is enabled in your Google Cloud project

### "Lever API error"
- Verify your Lever API key is correct
- Make sure your Lever User ID is a valid UUID
- Check that your API key has permission to submit feedback

## File Structure

```
academy-interview-assistant/
├── manifest.json        # Extension configuration
├── background.js        # Service worker (Google Drive API)
├── content.js           # Google Meet page script
├── settings.html/js     # Extension popup
├── feedback-page.html/js # Feedback form UI
├── icon.png             # Extension icon
└── SETUP.md             # This file
```
