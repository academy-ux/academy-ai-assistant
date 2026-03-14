-- Add PostgreSQL full-text search to interviews table
-- Uses two strategies: full-text search (stemmed, ranked) + ilike fallback (exact substring)
-- This ensures proper nouns like "DeepMind" are found even when the stemmer doesn't recognize them

-- 1. Add a generated tsvector column combining all searchable fields
-- Weights: A = name/title (highest priority), B = position/summary, C = transcript
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

-- 3. pg_trgm extension for trigram-based ilike performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Trigram indexes on high-value fields for fast ilike
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_name_trgm
  ON interviews USING gin(candidate_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_interviews_meeting_title_trgm
  ON interviews USING gin(meeting_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_interviews_position_trgm
  ON interviews USING gin(position gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_interviews_summary_trgm
  ON interviews USING gin(summary gin_trgm_ops);

-- 5. RPC: full-text search + ilike fallback, deduplicated and ranked
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
  ilike_pattern text;
BEGIN
  tsquery_val := websearch_to_tsquery('english', search_query);
  ilike_pattern := '%' || search_query || '%';

  RETURN QUERY
  SELECT *
  FROM (
    -- Deduplicate: if a row matches both strategies, keep the higher rank
    SELECT DISTINCT ON (sub.id)
      sub.id,
      sub.created_at,
      sub.meeting_title,
      sub.meeting_date,
      sub.candidate_name,
      sub."position",
      sub.transcript,
      sub.summary,
      sub.rating,
      sub.meeting_type,
      sub.owner_email,
      sub.rank
    FROM (
      -- Strategy 1: Full-text search (stemmed, ranked by relevance)
      SELECT
        i.id, i.created_at, i.meeting_title, i.meeting_date,
        i.candidate_name, i."position", i.transcript, i.summary,
        i.rating, i.meeting_type, i.owner_email,
        ts_rank_cd(i.search_vector, tsquery_val) AS rank
      FROM interviews i
      WHERE tsquery_val != ''::tsquery
        AND i.search_vector @@ tsquery_val

      UNION ALL

      -- Strategy 2: Substring match on key fields (proper nouns, compound words)
      -- Skips transcript (too large for ilike) — searches name, title, position, summary
      SELECT
        i.id, i.created_at, i.meeting_title, i.meeting_date,
        i.candidate_name, i."position", i.transcript, i.summary,
        i.rating, i.meeting_type, i.owner_email,
        0.01::real AS rank
      FROM interviews i
      WHERE i.candidate_name ILIKE ilike_pattern
         OR i.meeting_title ILIKE ilike_pattern
         OR i."position" ILIKE ilike_pattern
         OR i.summary ILIKE ilike_pattern
    ) sub
    ORDER BY sub.id, sub.rank DESC
  ) deduped
  ORDER BY deduped.rank DESC
  LIMIT match_limit;
END;
$$;
