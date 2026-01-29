-- Add submitted_at column to interviews table (tracks Lever feedback submission time)
alter table interviews
add column if not exists submitted_at timestamp with time zone;

-- Index for filtering / sorting by submission time
create index if not exists idx_interviews_submitted_at
  on interviews(submitted_at desc nulls last);

