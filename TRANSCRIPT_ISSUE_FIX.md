# Transcript Issue Fix

## Problem

After a meeting ends, you're redirected to the feedback page but **don't see the meeting transcript**. Neither on the feedback page nor on the history page.

## Root Cause

The transcript import process was **failing silently**:

1. **Meeting ends** → Chrome extension redirects to `/feedback?meeting=code&title=title&ts=timestamp`

2. **Feedback page loads** → Automatically calls `pollForNewTranscript()` to import from Google Drive

3. **API call fails** → Most likely with error: "No Drive folder configured. Please import a folder first."

4. **Error hidden** → The error was only logged to browser console:
   ```javascript
   console.log('[Feedback] Drive poll not configured or failed:', res.status, errorData.error || '')
   ```

5. **User sees nothing** → Just "Searching for new transcripts..." that disappears, then no transcript appears

## Why It Fails

### First-Time Users
- **No Drive folder configured yet** in the database (`user_settings` table)
- The `/api/poll-drive` endpoint requires a Drive folder ID to search
- Returns error: `"No Drive folder configured. Please import a folder first."`

### Even With Drive Folder Configured
- Google Meet transcripts **take 1-2 minutes** to appear in Drive after meeting ends
- Extension redirects immediately when you leave the meeting
- Transcript doesn't exist in Drive yet when polling happens

### OAuth Token Issues
- The cron-based auto-polling has known OAuth limitations (see `POLLING_FEATURE.md`)
- Session-based manual polling works, but only if Drive folder is configured

## Solution Implemented

### 1. **Error State Tracking**
Added `pollingError` state to track when polling fails:

```typescript
const [pollingError, setPollingError] = useState<string | null>(null)
```

### 2. **Error Capture**
Updated `pollForNewTranscript()` to capture and display errors:

```typescript
if (res.ok) {
  // Success - reload interviews
} else {
  const errorData = await res.json().catch(() => ({}))
  const errorMsg = errorData.error || 'Drive poll failed'
  setPollingError(errorMsg)  // Now visible to user!
}
```

### 3. **Visible Error Messages**

#### When No Interviews + Error
Shows a comprehensive error card with:
- ❌ Red error indicator
- Clear error message
- **Actionable steps** based on the specific error
- Buttons to retry or navigate to History page

#### When Drive Folder Not Configured
Shows step-by-step setup instructions:
```
First-time setup required
1. Go to History page
2. Click "Import from Drive" button
3. Select your Google Drive folder with meeting transcripts
4. Return here and click "Check for new transcripts"
```

#### When Other Errors
Shows possible reasons:
- Transcript not yet in Drive (takes 1-2 minutes)
- Meeting transcript not saved to configured folder
- Drive permissions may need refresh

#### When Interviews Exist + Error
Shows a compact warning banner at top of interview list:
- ⚠️ "Latest transcript not found"
- Brief explanation
- Retry button

### 4. **Better UX**
- "Try again" button to re-poll Drive
- "Go to History" button for first-time setup
- Error persists until user takes action (not just logged and forgotten)

## How to Use (For Users)

### First Time Setup
1. **After your first meeting**, you'll see an error: "No Drive folder configured"
2. Click **"Go to History"** button
3. Click **"Import from Drive"** 
4. Select the Google Drive folder containing your Meet transcripts
5. Go back to Feedback page and click **"Try again"**

### Subsequent Meetings
- If transcript appears immediately → Great! Start your feedback
- If you see "Latest transcript not found" → Click retry button or wait 1-2 minutes
- Transcript will auto-import once it appears in your configured Drive folder

## Testing

To test the fix:

1. **Test error handling**:
   - Clear your Drive folder configuration from database
   - End a meeting and get redirected to feedback page
   - Should see clear error message with setup instructions

2. **Test timing issue**:
   - Configure Drive folder
   - End a meeting immediately (transcript won't be ready)
   - Should see "Latest transcript not found" with retry option
   - Wait 1-2 minutes and click retry
   - Should find and load transcript

3. **Test successful flow**:
   - Configure Drive folder
   - Wait 2+ minutes after meeting ends
   - Open feedback page
   - Should find and auto-select transcript

## Technical Details

### Files Modified
- `/web-app/app/feedback/page.tsx`

### Changes Made
1. Added `pollingError` state variable
2. Updated `pollForNewTranscript()` to capture errors
3. Added comprehensive error UI for "no interviews" case
4. Added compact error banner for "interviews exist" case
5. Imported `RefreshCw`, `Link`, and `useRouter` components

### API Endpoints Involved
- `POST /api/poll-drive` - Polls Drive folder for new transcripts
  - Requires: User session with OAuth token
  - Requires: Drive folder ID in `user_settings` table
  - Returns: `{ imported, skipped, errors, totalFiles }`
  
- `GET /api/interviews?limit=100&offset=0` - Fetches interview list
  - Returns: List of interviews from database

## Next Steps

### For Users
1. Complete first-time Drive folder setup
2. Ensure Google Meet saves transcripts to your Drive
3. Check that transcripts appear in the configured folder

### For Developers (Future Improvements)
1. **Auto-configure Drive folder** from first transcript import
2. **Retry with exponential backoff** - Auto-retry 2-3 times with delays
3. **Browser notification** when transcript is ready
4. **Better timing detection** - Only start polling after reasonable delay
5. **OAuth refresh tokens** for true automated polling (see `POLLING_FEATURE.md`)

## Related Documentation
- `POLLING_FEATURE.md` - Detailed polling feature documentation
- `PRODUCTION_PANEL_SUMMARY.md` - Chrome extension panel documentation
