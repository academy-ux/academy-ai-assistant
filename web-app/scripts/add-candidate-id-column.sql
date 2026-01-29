-- Migration: Add candidate_id column to interviews table
-- This stores the Lever opportunity ID when feedback is submitted

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interviews' AND column_name = 'candidate_id'
  ) THEN
    ALTER TABLE interviews ADD COLUMN candidate_id text;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id 
      ON interviews(candidate_id);
    
    RAISE NOTICE 'Added candidate_id column and index to interviews table';
  ELSE
    RAISE NOTICE 'candidate_id column already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'interviews' 
  AND column_name IN ('candidate_id', 'submitted_at')
ORDER BY column_name;
