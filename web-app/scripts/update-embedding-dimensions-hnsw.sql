-- Update embedding vector dimensions from 768 to 3072
-- This is required for gemini-embedding-001 model
-- Using HNSW index instead of IVFFlat (supports more dimensions)

-- Step 1: Add new column with correct dimensions
ALTER TABLE interviews 
ADD COLUMN embedding_new vector(3072);

-- Step 2: Drop old column
ALTER TABLE interviews 
DROP COLUMN embedding;

-- Step 3: Rename new column
ALTER TABLE interviews 
RENAME COLUMN embedding_new TO embedding;

-- Step 4: Recreate the index using HNSW (supports >2000 dimensions)
DROP INDEX IF EXISTS idx_interviews_embedding;
CREATE INDEX idx_interviews_embedding 
  ON interviews USING hnsw (embedding vector_cosine_ops);

-- Step 5: Update the match_interviews function (with quoted 'position' keyword)
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
