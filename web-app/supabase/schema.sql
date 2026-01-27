-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Interviews table: stores transcript and metadata
create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),

  -- Meeting metadata
  meeting_code text,
  meeting_title text,
  meeting_date timestamp with time zone,

  -- Candidate info (from Lever)
  candidate_id text,
  candidate_name text,
  candidate_email text,
  position text,

  -- Transcript
  transcript text,
  transcript_file_name text,

  -- Analysis
  rating text,
  summary text,
  
  -- Embedding for semantic search (768 dimensions for Gemini text-embedding-004)
  embedding vector(768)
);

-- Index for faster vector similarity search
create index on interviews using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to search interviews by similarity
create or replace function match_interviews (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  created_at timestamp with time zone,
  meeting_title text,
  candidate_name text,
  position text,
  transcript text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    interviews.id,
    interviews.created_at,
    interviews.meeting_title,
    interviews.candidate_name,
    interviews.position,
    interviews.transcript,
    1 - (interviews.embedding <=> query_embedding) as similarity
  from interviews
  where 1 - (interviews.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
