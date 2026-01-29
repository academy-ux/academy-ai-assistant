-- Add drive_file_id column to track Google Drive file IDs
-- This allows us to detect duplicates even if files are renamed in Drive

ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS drive_file_id text;

-- Create index for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_interviews_drive_file_id 
  ON interviews(drive_file_id);

-- Create index for file name lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_interviews_transcript_file_name 
  ON interviews(transcript_file_name);
