-- Migration: Add meeting_type column with proper check constraint
-- This ensures all meeting types used in the app are valid

-- Add meeting_type column if it doesn't exist
alter table interviews 
add column if not exists meeting_type text;

-- Create index for filtering by meeting type
create index if not exists idx_interviews_meeting_type 
  on interviews(meeting_type);

-- Drop the old constraint if it exists
alter table interviews 
drop constraint if exists check_meeting_type;

-- Add the new constraint with all valid meeting types
alter table interviews 
add constraint check_meeting_type 
check (meeting_type is null or meeting_type in (
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

-- Also add owner_email column if not exists (for user isolation)
alter table interviews
add column if not exists owner_email text;

-- Create index for owner_email
create index if not exists idx_interviews_owner_email 
  on interviews(owner_email);
