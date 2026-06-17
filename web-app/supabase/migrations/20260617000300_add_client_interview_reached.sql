-- Durable record that a candidate reached the Client Interview stage for a
-- posting. Persists even if the candidate is later moved or archived, so funnel
-- conversion counts everyone who EVER made it into a client interview.
create table if not exists client_interview_reached (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null,
  posting_id text not null,
  candidate_email text,
  reached_at timestamp with time zone default now(),
  unique (candidate_id, posting_id)
);

alter table client_interview_reached enable row level security;

drop policy if exists "Allow read client_interview_reached" on client_interview_reached;
create policy "Allow read client_interview_reached" on client_interview_reached for select using (true);
drop policy if exists "Allow insert client_interview_reached" on client_interview_reached;
create policy "Allow insert client_interview_reached" on client_interview_reached for insert with check (true);
drop policy if exists "Allow update client_interview_reached" on client_interview_reached;
create policy "Allow update client_interview_reached" on client_interview_reached for update using (true);

create index if not exists idx_cir_posting on client_interview_reached(posting_id);
