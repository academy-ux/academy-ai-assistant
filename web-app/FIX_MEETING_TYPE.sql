-- ============================================
-- FIX: meeting_type constraint error
-- ============================================
-- This fixes the error: "new row for relation 'interviews' violates check constraint 'check_meeting_type'"
-- 
-- HOW TO APPLY:
-- 1. Go to your Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor (in the left sidebar)
-- 4. Copy and paste this entire file
-- 5. Click "Run"
-- ============================================

-- Step 1: Add meeting_type column (if it doesn't exist)
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS meeting_type TEXT;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_interviews_meeting_type 
ON interviews(meeting_type);

-- Step 3: Drop old constraint (if it exists)
ALTER TABLE interviews 
DROP CONSTRAINT IF EXISTS check_meeting_type;

-- Step 4: Add new constraint with ALL valid meeting types
ALTER TABLE interviews 
ADD CONSTRAINT check_meeting_type 
CHECK (meeting_type IS NULL OR meeting_type IN (
  'Interview',
  'Client Debrief',
  'Sales Meeting',
  'Status Update',
  'Planning Meeting',
  'Team Sync',
  'Client Call',
  '1-on-1',
  'All Hands',
  'Standup',
  'Retrospective',
  'Demo',
  'Other'
));

-- Step 5: Verify (should return no errors)
SELECT meeting_type, COUNT(*) as count
FROM interviews
WHERE meeting_type IS NOT NULL
GROUP BY meeting_type
ORDER BY count DESC;
