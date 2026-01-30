-- 1. Add owner_email column for user-specific filtering
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS owner_email text;
CREATE INDEX IF NOT EXISTS idx_interviews_owner_email ON interviews(owner_email);

-- 2. Drop old function to allow signature change
DROP FUNCTION IF EXISTS match_interviews(vector, float, int);

-- 3. Create updated function with filter_types parameter for security guardrails
create or replace function match_interviews (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  filter_types text[] default null
)
returns table (
  id uuid,
  created_at timestamp with time zone,
  meeting_title text,
  candidate_name text,
  "position" text,
  transcript text,
  meeting_type text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    interviews.id,
    interviews.created_at,
    interviews.meeting_title,
    interviews.candidate_name,
    interviews."position",
    interviews.transcript,
    interviews.meeting_type,
    1 - (interviews.embedding <=> query_embedding) as similarity
  from interviews
  where interviews.embedding is not null
    and 1 - (interviews.embedding <=> query_embedding) > match_threshold
    and (filter_types is null or interviews.meeting_type = any(filter_types))
  order by similarity desc
  limit match_count;
end;
$$;
