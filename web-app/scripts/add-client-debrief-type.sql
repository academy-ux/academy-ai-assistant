-- Migration: Add "Client Debrief" meeting type
-- This updates the check constraint to include the new meeting type

-- Drop the old constraint if it exists
alter table interviews 
drop constraint if exists check_meeting_type;

-- Add the new constraint with "Client Debrief"
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
