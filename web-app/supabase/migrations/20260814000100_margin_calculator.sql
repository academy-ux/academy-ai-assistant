-- Profit margin calculator (admin-only /margin page).
-- margin_deals: one row per placement/deal, with a jsonb snapshot of the
-- numbers at each lifecycle stage (estimate -> placed -> actual) so we can
-- measure margin drift. margin_settings: single-row config (thresholds,
-- burden %, recruiter rates, level rate card).

create table if not exists margin_deals (
  id uuid primary key,
  project_code text not null,
  role_title text not null default '',
  client text not null default '',
  contractor text not null default '',
  engagement_type text not null default 'contractor' check (engagement_type in ('contractor', 'employee')),
  stage text not null default 'estimate' check (stage in ('estimate', 'placed', 'completed')),
  estimate jsonb,
  placed jsonb,
  actual jsonb,
  notes text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists margin_settings (
  id text primary key default 'default',
  data jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Service-role only (the app talks to Supabase exclusively with the service
-- key server-side); RLS on with no anon policies, matching the other tables.
alter table margin_deals enable row level security;
alter table margin_settings enable row level security;
