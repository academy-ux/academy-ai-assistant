-- Server-side client logo config: replaces per-browser localStorage overrides
-- so uploaded/custom logos are consistent for all staff and shared client views.
CREATE TABLE IF NOT EXISTS client_logos (
  team_key TEXT PRIMARY KEY, -- lowercased trimmed team/client name
  domain TEXT,               -- domain override for logo.dev / favicon lookup
  logo_path TEXT,            -- storage object path of an uploaded logo (wins over domain)
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE client_logos ENABLE ROW LEVEL SECURITY;

-- Public storage bucket for uploaded logos (read via public URL; writes go
-- through the service role in the API route).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;
