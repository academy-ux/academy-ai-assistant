-- Add meeting_type column to interviews table
alter table interviews 
add column if not exists meeting_type text;

-- Create index for filtering by meeting type
create index if not exists idx_interviews_meeting_type 
  on interviews(meeting_type);

-- Add check constraint to ensure valid meeting types
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
