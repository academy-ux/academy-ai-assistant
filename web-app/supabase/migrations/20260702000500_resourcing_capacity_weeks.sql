-- Week-scoped capacity overrides: each week is independent, so editing
-- capacity never rewrites history (replaces the global resourcing_capacity_overrides).
CREATE TABLE IF NOT EXISTS resourcing_capacity_weeks (
  person TEXT NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week
  weekly_hours NUMERIC NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person, week_start)
);
ALTER TABLE resourcing_capacity_weeks ENABLE ROW LEVEL SECURITY;
