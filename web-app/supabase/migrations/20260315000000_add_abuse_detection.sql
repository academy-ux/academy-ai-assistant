-- ============================================
-- Abuse Detection & User Restriction System
-- ============================================

-- Abuse log table: records all flagged events
CREATE TABLE IF NOT EXISTS abuse_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_name text,
  event_type text NOT NULL,         -- 'scrape_attempt', 'rate_exceeded', 'bulk_extraction', 'pattern_flagged'
  severity text NOT NULL DEFAULT 'warning',  -- 'warning', 'critical', 'blocked'
  endpoint text NOT NULL,           -- '/api/interviews/ask', '/api/interviews/search', etc.
  details jsonb,                    -- query text, pattern matched, request count, etc.
  created_at timestamptz DEFAULT now()
);

-- Index for querying by user and recency
CREATE INDEX IF NOT EXISTS idx_abuse_logs_user_email ON abuse_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_abuse_logs_created_at ON abuse_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_logs_severity ON abuse_logs(severity);

-- Add restriction columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS is_restricted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricted_at timestamptz,
  ADD COLUMN IF NOT EXISTS restricted_reason text;

-- RLS: only service role can write abuse logs (API routes use service role client)
ALTER TABLE abuse_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to abuse_logs" ON abuse_logs;
CREATE POLICY "Service role full access to abuse_logs"
  ON abuse_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
