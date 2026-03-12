-- Create shared_reports table for public share links
CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  posting_id TEXT NOT NULL,
  posting_title TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON shared_reports(token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_posting_id ON shared_reports(posting_id);
