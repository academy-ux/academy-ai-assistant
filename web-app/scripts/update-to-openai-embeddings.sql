-- Update to OpenAI embeddings (1536 dimensions)
-- This fits within Supabase's 2000 dimension index limit

-- Step 1: Add new column for OpenAI embeddings
ALTER TABLE interviews 
ADD COLUMN embedding_new vector(1536);

-- Step 2: Drop old column and index
DROP INDEX IF EXISTS idx_interviews_embedding;
ALTER TABLE interviews 
DROP COLUMN embedding;

-- Step 3: Rename new column
ALTER TABLE interviews 
RENAME COLUMN embedding_new TO embedding;

-- Step 4: Create HNSW index (fast for 1000+ meetings)
CREATE INDEX idx_interviews_embedding 
  ON interviews USING hnsw (embedding vector_cosine_ops);

-- Step 5: Update the match_interviews function
CREATE OR REPLACE FUNCTION match_interviews (
  query_embedding vector(1536),
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
