# Migration: Add Drive File ID Column

## Overview
This migration adds a `drive_file_id` column to the `interviews` table to enable more robust duplicate detection when importing Google Drive files.

## Why This Change?
Previously, duplicate detection only used the file name (`transcript_file_name`). This had limitations:
- If a file was renamed in Drive and re-imported, it would be treated as a new file
- Multiple files with the same name could cause issues
- No way to track the actual source file in Google Drive

Now, we use the Google Drive file ID as the primary duplicate check, with file name as a fallback for backwards compatibility.

## Migration Steps

### 1. Run the SQL Migration

Execute the migration script against your Supabase database:

```bash
# Copy the contents of scripts/add-drive-file-id-column.sql
# and run it in your Supabase SQL editor
```

Or manually run:

```sql
-- Add drive_file_id column to track Google Drive file IDs
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS drive_file_id text;

-- Create indexes for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_interviews_drive_file_id 
  ON interviews(drive_file_id);

CREATE INDEX IF NOT EXISTS idx_interviews_transcript_file_name 
  ON interviews(transcript_file_name);
```

### 2. Deploy the Code Changes

The following files have been updated:
- `app/api/drive/import/route.ts` - Main import endpoint
- `app/api/drive/import/stream/route.ts` - Streaming import endpoint
- `app/api/cron/poll-drive/route.ts` - Polling endpoint
- `supabase/schema.sql` - Schema documentation

Deploy these changes to your environment.

### 3. Backwards Compatibility

The new code is fully backwards compatible:
- Existing interviews without `drive_file_id` will still work
- Duplicate checking first tries `drive_file_id`, then falls back to `transcript_file_name`
- New imports will populate both fields

## What Changed

### Before
```typescript
// Only checked by file name
const { data: existing } = await supabase
  .from('interviews')
  .select('id')
  .eq('transcript_file_name', file.name)
  .single()
```

### After
```typescript
// Check by Drive file ID first (more reliable)
let existing = null

if (file.id) {
  const { data: existingById } = await supabase
    .from('interviews')
    .select('id')
    .eq('drive_file_id', file.id)
    .maybeSingle()
  existing = existingById
}

// Fallback to file name for backwards compatibility
if (!existing && file.name) {
  const { data: existingByName } = await supabase
    .from('interviews')
    .select('id')
    .eq('transcript_file_name', file.name)
    .maybeSingle()
  existing = existingByName
}
```

## Testing

After migration, test the following scenarios:
1. ✅ Import a folder with new files - should import successfully
2. ✅ Re-import the same folder - should skip all files as duplicates
3. ✅ Rename a file in Drive and re-import - should skip it (same Drive ID)
4. ✅ Check that existing interviews still work and are searchable

## Rollback

If needed, you can rollback by:
1. Reverting the code changes
2. Optionally dropping the column (though it won't hurt to keep it):
   ```sql
   ALTER TABLE interviews DROP COLUMN IF EXISTS drive_file_id;
   DROP INDEX IF EXISTS idx_interviews_drive_file_id;
   ```
