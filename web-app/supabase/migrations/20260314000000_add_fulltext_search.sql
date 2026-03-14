-- Add PostgreSQL full-text search to interviews table
-- Replaces ilike substring matching with proper tsvector/tsquery search
-- Supports stemming, ranking, and prefix matching without external AI APIs

-- 1. Add a generated tsvector column combining all searchable fields
-- Weights: A = name/title (highest), B = position/summary, C = transcript
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(candidate_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(meeting_title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(position, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(transcript, '')), 'C')
) STORED;

-- 2. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_interviews_search_vector
  ON interviews USING gin(search_vector);

-- 3. RPC function for full-text search with ranking
CREATE OR REPLACE FUNCTION search_interviews(
  search_query text,
  match_limit int default 20
)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  meeting_title text,
  meeting_date timestamp with time zone,
  candidate_name text,
  "position" text,
  transcript text,
  summary text,
  rating text,
  meeting_type text,
  owner_email text,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Build tsquery: split words and join with & (AND), add prefix matching with :*
  tsquery_val := websearch_to_tsquery('english', search_query);

  -- If websearch parse produces empty query, fall back to prefix match
  IF tsquery_val = ''::tsquery THEN
    tsquery_val := to_tsquery('english', search_query || ':*');
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.created_at,
    i.meeting_title,
    i.meeting_date,
    i.candidate_name,
    i."position",
    i.transcript,
    i.summary,
    i.rating,
    i.meeting_type,
    i.owner_email,
    ts_rank_cd(i.search_vector, tsquery_val) AS rank
  FROM interviews i
  WHERE i.search_vector @@ tsquery_val
  ORDER BY rank DESC
  LIMIT match_limit;
END;
$$;
