# Auto-Polling Feature

## Overview

The Auto-Polling feature automatically checks your configured Google Drive folder for new meeting transcripts and imports them without manual intervention. This provides a fallback mechanism if the Chrome extension fails or if you prefer automated imports.

## How It Works

1. **Initial Setup**: When you import transcripts from a Drive folder, the folder ID is automatically saved to your user settings
2. **Enable Auto-Polling**: Go to Settings and toggle "Enable Auto-Polling"
3. **Configure Interval**: Choose how often to check (5 minutes to 6 hours)
4. **Automatic Import**: A cron job periodically checks for new files and imports them

## Database Schema

A new `user_settings` table stores polling configuration:

```sql
- user_email: Unique identifier for the user
- drive_folder_id: Google Drive folder ID to poll
- folder_name: Human-readable folder name
- auto_poll_enabled: Boolean to enable/disable polling
- poll_interval_minutes: How often to poll (default: 15)
- last_poll_time: When the last poll occurred
- last_poll_file_count: Number of files found in last poll
```

To create the table, run:

```bash
cd web-app
psql $DATABASE_URL < scripts/add-user-settings.sql
```

Or execute the SQL directly in your Supabase SQL editor.

## Setup Instructions

### 1. Database Setup

Run the migration script:

```bash
cd web-app
# Copy the SQL from scripts/add-user-settings.sql
# Paste it into Supabase SQL Editor and run
```

### 2. Environment Variables

Add to your `.env.local`:

```bash
CRON_SECRET=your-secret-here-generate-with-openssl-rand-base64-32
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

### 3. Vercel Cron Configuration

The `vercel.json` file configures the cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-drive",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs every 15 minutes. The actual check interval per user is controlled by their settings.

### 4. Deploy to Production

```bash
cd web-app
vercel --prod
```

Set the `CRON_SECRET` environment variable in Vercel:

```bash
vercel env add CRON_SECRET production
# Paste your generated secret
```

## API Endpoints

### GET/POST `/api/settings`

Get or update user polling settings.

**GET Response:**
```json
{
  "driveFolderId": "1abc123...",
  "folderName": "Meeting Transcripts",
  "autoPollEnabled": true,
  "pollIntervalMinutes": 15,
  "lastPollTime": "2024-01-15T10:30:00Z",
  "lastPollFileCount": 42
}
```

**POST Body:**
```json
{
  "autoPollEnabled": true,
  "pollIntervalMinutes": 30
}
```

### POST `/api/poll-drive`

Manually trigger a poll for the current user.

**Response:**
```json
{
  "success": true,
  "imported": 3,
  "skipped": 15,
  "errors": 0,
  "totalFiles": 18,
  "lastPollTime": "2024-01-15T10:35:00Z"
}
```

### GET `/api/cron/poll-drive`

Cron endpoint that polls all users with auto-polling enabled. Secured with `CRON_SECRET`.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

## User Interface

### Settings Dialog

Access via the "Settings" button on the History page:

- **Folder Info**: Shows configured Drive folder and last poll time
- **Enable Auto-Polling**: Toggle to enable/disable
- **Check Interval**: Dropdown to select polling frequency
- **Check Now**: Button to manually trigger a poll
- **Poll Results**: Shows results after manual polling

### Workflow

1. User imports transcripts from Drive → Folder ID saved automatically
2. User opens Settings → Toggles "Enable Auto-Polling"
3. User selects interval (e.g., "Every 30 minutes")
4. Cron job runs every 15 minutes, checks each user's interval
5. If enough time has passed, imports new files from user's folder
6. User sees new transcripts appear in their history

## Limitations

### OAuth Token Expiry

The automated cron job has a limitation: it doesn't have access to user OAuth tokens, which are required to access Google Drive. This means:

- ❌ **Automated cron polling** won't work automatically (OAuth limitation)
- ✅ **Manual "Check Now"** works perfectly (uses active user session)
- ✅ **Chrome extension** still works as primary method

### Current Implementation

The cron job updates `last_poll_time` but cannot actually fetch files without an OAuth token. To make full automation work, you would need to:

1. Store refresh tokens (requires Google OAuth scope changes)
2. Implement token refresh logic
3. Handle token expiry and re-authorization

### Recommended Approach

For now, the polling feature works best as:

1. **Primary**: Chrome extension auto-opens feedback form after meetings
2. **Fallback**: Manual "Check Now" button in Settings
3. **Future**: Implement OAuth refresh tokens for true automation

## Testing

### Test Manual Polling

1. Import a folder with transcripts
2. Add a new Google Doc transcript to that folder
3. Open Settings dialog
4. Click "Check Now"
5. Verify the new file is imported

### Test Settings

1. Import a folder
2. Open Settings
3. Toggle auto-polling on/off
4. Change interval
5. Verify settings persist on page reload

### Test Cron Endpoint (Local)

```bash
cd web-app

# Start dev server
npm run dev

# In another terminal, trigger cron
curl http://localhost:3000/api/cron/poll-drive \
  -H "Authorization: Bearer your-cron-secret"
```

## Troubleshooting

### Settings not loading

- Check that the `user_settings` table exists
- Verify user is authenticated
- Check browser console for errors

### Manual poll fails

- Ensure user has imported a folder first
- Check that OAuth session is valid
- Verify Drive folder still exists and is accessible

### Cron job not running

- Verify `vercel.json` is deployed
- Check `CRON_SECRET` is set in Vercel environment variables
- View cron logs in Vercel dashboard

## Future Enhancements

1. **OAuth Refresh Tokens**: Store and refresh tokens for true automated polling
2. **Webhook Integration**: Google Drive API webhooks for instant notifications
3. **Selective Sync**: Choose specific files or folders to import
4. **Conflict Resolution**: Handle duplicate or renamed files
5. **Batch Optimization**: Import multiple files more efficiently
6. **Email Notifications**: Alert users when new transcripts are imported
