-- Client accept/reject decisions on candidates in a shared report.
-- Keyed by candidate_id (Lever opportunity id) + posting_id so it works without
-- exposing the candidate email to the public share. Does NOT change Lever stage —
-- it's an advisory signal recruiters act on manually.
create table if not exists client_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  candidate_id text not null,
  candidate_email text,
  posting_id text not null,
  decision text not null check (decision in ('accepted', 'rejected')),
  decided_by text,
  share_token uuid,
  unique (candidate_id, posting_id)
);

alter table client_decisions enable row level security;

drop policy if exists "Allow read for client_decisions" on client_decisions;
create policy "Allow read for client_decisions" on client_decisions for select using (true);
drop policy if exists "Allow insert for client_decisions" on client_decisions;
create policy "Allow insert for client_decisions" on client_decisions for insert with check (true);
drop policy if exists "Allow update for client_decisions" on client_decisions;
create policy "Allow update for client_decisions" on client_decisions for update using (true);
drop policy if exists "Allow delete for client_decisions" on client_decisions;
create policy "Allow delete for client_decisions" on client_decisions for delete using (true);

create index if not exists idx_client_decisions_candidate on client_decisions(candidate_id);
create index if not exists idx_client_decisions_posting on client_decisions(posting_id);

drop trigger if exists update_client_decisions_updated_at on client_decisions;
create trigger update_client_decisions_updated_at
  before update on client_decisions
  for each row execute function update_updated_at_column();
