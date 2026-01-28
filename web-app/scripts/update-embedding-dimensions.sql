-- Update embedding vector dimensions from 768 to 3072
-- This is required for gemini-embedding-001 model

-- Step 1: Add new column with correct dimensions
ALTER TABLE interviews 
ADD COLUMN embedding_new vector(3072);

-- Step 2: Copy existing data (will be NULL for existing rows)
-- Existing embeddings will need to be regenerated

-- Step 3: Drop old column
ALTER TABLE interviews 
DROP COLUMN embedding;

-- Step 4: Rename new column
ALTER TABLE interviews 
RENAME COLUMN embedding_new TO embedding;

-- Step 5: Recreate the index
DROP INDEX IF EXISTS idx_interviews_embedding;
CREATE INDEX idx_interviews_embedding 
  ON interviews USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 6: Update the match_interviews function
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
  position text,
  transcript text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate inputs
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
    interviews.position,
    interviews.transcript,
    1 - (interviews.embedding <=> query_embedding) AS similarity
  FROM interviews
  WHERE interviews.embedding IS NOT NULL 
    AND 1 - (interviews.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
