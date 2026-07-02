-- Resourcing Planner: planner-authored state layered on top of Harvest actuals.
-- Harvest data is never stored here — it is fetched live and cached in-process.

CREATE TABLE IF NOT EXISTS resourcing_bookings (
  id UUID PRIMARY KEY,
  person TEXT NOT NULL,
  client TEXT NOT NULL,
  hours_per_day NUMERIC NOT NULL,
  start_day DATE NOT NULL,
  end_day DATE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resourcing_timeoff (
  id UUID PRIMARY KEY,
  person TEXT NOT NULL,
  start_day DATE NOT NULL,
  end_day DATE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets are in-app targets: Harvest has no budgets configured on these projects.
CREATE TABLE IF NOT EXISTS resourcing_budgets (
  label TEXT PRIMARY KEY, -- "<Client> · <kind>"
  hours NUMERIC NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What-if capacity overrides (the real fix belongs in Harvest's weekly capacity).
CREATE TABLE IF NOT EXISTS resourcing_capacity_overrides (
  person TEXT PRIMARY KEY,
  weekly_hours NUMERIC NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-side access only (service role bypasses RLS; no anon policies on purpose).
ALTER TABLE resourcing_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resourcing_timeoff ENABLE ROW LEVEL SECURITY;
ALTER TABLE resourcing_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE resourcing_capacity_overrides ENABLE ROW LEVEL SECURITY;
