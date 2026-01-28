# Academy Interview Assistant - Chrome Extension

Automatically opens the feedback form when you leave a Google Meet interview.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select this folder (`academy-interview-assistant`)

The extension is now installed and will automatically monitor your Google Meet sessions.

## How It Works

1. **Join a Google Meet** - The extension detects when you're in a meeting
2. **Leave the meeting** - Click the "Leave call" button
3. **Automatic redirect** - A new tab opens with the feedback form at:
   ```
   https://academy-ai-assistant.vercel.app/feedback?meeting={code}&title={title}
   ```

## Testing

### Quick Test
1. Join any Google Meet (you can create a test meeting)
2. Open Chrome DevTools Console (F12)
3. Look for `[Academy]` log messages:
   - "Content script initialized"
   - "Joined meeting"
   - Meeting code and title detection
4. Leave the meeting
5. Verify the feedback form opens automatically

### What Gets Captured
- **Meeting Code**: Extracted from URL (e.g., `abc-defg-hij`)
- **Meeting Title**: Extracted from page title or meeting name
- **Timestamp**: When the meeting ended

## Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker that opens the feedback form
- `content.js` - Monitors Google Meet for meeting start/end
- `icon.png` - Extension icon

## Production URL

The extension is configured to use the production deployment:
**https://academy-ai-assistant.vercel.app/**

No configuration needed - it just works!

## Debugging

If the extension isn't working:

1. Check that it's enabled in `chrome://extensions/`
2. Open Chrome DevTools Console during a Google Meet
3. Look for `[Academy]` log messages
4. Verify the extension has permissions for `meet.google.com`
5. Try reloading the extension or refreshing the Google Meet page

## Version

Current version: **3.1.0**
