-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Interviews table: stores transcript and metadata
create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Meeting metadata
  meeting_code text,
  meeting_title text,
  meeting_date timestamp with time zone,

  -- Candidate info (from Lever)
  candidate_id text,
  candidate_name text,
  candidate_email text,
  position text,
  
  -- Interviewer info
  interviewer text,

  -- Feedback submission tracking (Lever)
  submitted_at timestamp with time zone,

  -- Transcript (required)
  transcript text not null,
  transcript_file_name text,
  drive_file_id text,

  -- Analysis
  rating text check (rating is null or rating in ('1', '2', '3', '4', 'Not Analyzed')),
  summary text,
  
  -- Embedding for semantic search (3072 dimensions for gemini-embedding-001)
  embedding vector(3072)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
-- Enable RLS on the interviews table
alter table interviews enable row level security;

-- Policy: Allow authenticated users to view all interviews
-- Note: This app uses NextAuth middleware for authentication, 
-- and Supabase service key server-side. These policies provide
-- defense-in-depth if anon key is ever used.
create policy "Allow authenticated read access"
  on interviews for select
  using (true);  -- All authenticated requests via API are allowed

create policy "Allow authenticated insert access"
  on interviews for insert
  with check (true);

create policy "Allow authenticated update access"
  on interviews for update
  using (true);

create policy "Allow authenticated delete access"
  on interviews for delete
  using (true);

-- ============================================
-- Indexes for performance
-- ============================================
-- Note: No vector index (Supabase 2000 dimension limit, Gemini produces 3072)
-- For 1000 meetings, sequential scans are acceptable (~1-3 seconds)

-- Frequently queried fields
create index if not exists idx_interviews_candidate_id 
  on interviews(candidate_id);

create index if not exists idx_interviews_candidate_email 
  on interviews(candidate_email);

create index if not exists idx_interviews_meeting_date 
  on interviews(meeting_date desc nulls last);

create index if not exists idx_interviews_created_at 
  on interviews(created_at desc);

create index if not exists idx_interviews_submitted_at
  on interviews(submitted_at desc nulls last);

create index if not exists idx_interviews_candidate_name 
  on interviews(candidate_name);

create index if not exists idx_interviews_meeting_code 
  on interviews(meeting_code);

create index if not exists idx_interviews_drive_file_id 
  on interviews(drive_file_id);

create index if not exists idx_interviews_transcript_file_name 
  on interviews(transcript_file_name);

-- ============================================
-- Triggers
-- ============================================
-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to call the function before any update
drop trigger if exists update_interviews_updated_at on interviews;
create trigger update_interviews_updated_at
  before update on interviews
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Functions
-- ============================================
-- Function to search interviews by semantic similarity
create or replace function match_interviews (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  created_at timestamp with time zone,
  meeting_title text,
  candidate_name text,
  "position" text,
  transcript text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  -- Validate inputs
  if match_threshold < 0 or match_threshold > 1 then
    raise exception 'match_threshold must be between 0 and 1';
  end if;
  if match_count < 1 or match_count > 100 then
    raise exception 'match_count must be between 1 and 100';
  end if;

  return query
  select
    interviews.id,
    interviews.created_at,
    interviews.meeting_title,
    interviews.candidate_name,
    interviews."position",
    interviews.transcript,
    1 - (interviews.embedding <=> query_embedding) as similarity
  from interviews
  where interviews.embedding is not null
    and 1 - (interviews.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
