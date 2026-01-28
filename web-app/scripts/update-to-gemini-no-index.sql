-- Use Gemini embeddings (3072 dims) without index
-- Performance: ~1-3s for 1000 meetings (acceptable)

-- Step 1: Add new column with 3072 dimensions
ALTER TABLE interviews 
ADD COLUMN embedding_new vector(3072);

-- Step 2: Drop old index and column
DROP INDEX IF EXISTS idx_interviews_embedding;
ALTER TABLE interviews 
DROP COLUMN embedding;

-- Step 3: Rename new column
ALTER TABLE interviews 
RENAME COLUMN embedding_new TO embedding;

-- Step 4: Update match_interviews function for 3072 dimensions
CREATE OR REPLACE FUNCTION match_interviews (
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  meeting_title text,
  candidate_name text,
  "position" text,
  transcript text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF match_threshold < 0 OR match_threshold > 1 THEN
    RAISE EXCEPTION 'match_threshold must be between 0 and 1';
  END IF;
  IF match_count < 1 OR match_count > 100 THEN
    RAISE EXCEPTION 'match_count must be between 1 and 100';
  END IF;

  RETURN QUERY
  SELECT
    interviews.id,
    interviews.created_at,
    interviews.meeting_title,
    interviews.candidate_name,
    interviews."position",
    interviews.transcript,
    1 - (interviews.embedding <=> query_embedding) AS similarity
  FROM interviews
  WHERE interviews.embedding IS NOT NULL 
    AND 1 - (interviews.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Note: No index due to Supabase 2000 dimension limit
-- For 1000 meetings, sequential scans are fast enough (~1-3 seconds)
