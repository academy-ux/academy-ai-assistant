-- Create candidate_pitches table for role-specific pitches
-- A candidate can have a different pitch for each posting/role they're being considered for.
create table if not exists candidate_pitches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  candidate_email text not null,
  posting_id text not null,
  pitch text not null,
  unique (candidate_email, posting_id)
);

-- Enable RLS
alter table candidate_pitches enable row level security;

-- Policies
drop policy if exists "Allow authenticated read for pitches" on candidate_pitches;
create policy "Allow authenticated read for pitches" on candidate_pitches for select using (true);
drop policy if exists "Allow authenticated insert for pitches" on candidate_pitches;
create policy "Allow authenticated insert for pitches" on candidate_pitches for insert with check (true);
drop policy if exists "Allow authenticated update for pitches" on candidate_pitches;
create policy "Allow authenticated update for pitches" on candidate_pitches for update using (true);
drop policy if exists "Allow authenticated delete for pitches" on candidate_pitches;
create policy "Allow authenticated delete for pitches" on candidate_pitches for delete using (true);

-- Indexes
create index if not exists idx_candidate_pitches_email on candidate_pitches(candidate_email);
create index if not exists idx_candidate_pitches_posting on candidate_pitches(posting_id);
create index if not exists idx_candidate_pitches_email_posting on candidate_pitches(candidate_email, posting_id);

-- Trigger for updated_at
drop trigger if exists update_candidate_pitches_updated_at on candidate_pitches;
create trigger update_candidate_pitches_updated_at
  before update on candidate_pitches
  for each row execute function update_updated_at_column();

-- Migrate existing pitches from candidate_profiles into candidate_pitches.
-- Since old pitches have no posting_id context, we skip them (they'll regenerate
-- per-role on next access). No data loss — the old pitch column stays until a
-- future cleanup migration.
