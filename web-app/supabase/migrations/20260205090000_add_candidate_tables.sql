-- Create candidate_notes table
create table if not exists candidate_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  candidate_email text not null,
  content text not null,
  created_by text
);

-- Create candidate_profiles table
create table if not exists candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  candidate_email text not null unique,
  pitch text,
  salary_expectations text,
  years_of_experience text
);

-- Create candidate_passwords table
create table if not exists candidate_passwords (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  candidate_email text not null unique,
  password text
);

-- Enable RLS
alter table candidate_notes enable row level security;
alter table candidate_profiles enable row level security;
alter table candidate_passwords enable row level security;

-- Policies (Service key on server, but defense-in-depth)
create policy "Allow authenticated read for notes" on candidate_notes for select using (true);
create policy "Allow authenticated insert for notes" on candidate_notes for insert with check (true);
create policy "Allow authenticated update for notes" on candidate_notes for update using (true);
create policy "Allow authenticated delete for notes" on candidate_notes for delete using (true);

create policy "Allow authenticated read for profiles" on candidate_profiles for select using (true);
create policy "Allow authenticated insert for profiles" on candidate_profiles for insert with check (true);
create policy "Allow authenticated update for profiles" on candidate_profiles for update using (true);
create policy "Allow authenticated delete for profiles" on candidate_profiles for delete using (true);

create policy "Allow authenticated read for passwords" on candidate_passwords for select using (true);
create policy "Allow authenticated insert for passwords" on candidate_passwords for insert with check (true);
create policy "Allow authenticated update for passwords" on candidate_passwords for update using (true);
create policy "Allow authenticated delete for passwords" on candidate_passwords for delete using (true);

-- Indexes
create index if not exists idx_candidate_notes_email on candidate_notes(candidate_email);
create index if not exists idx_candidate_profiles_email on candidate_profiles(candidate_email);
create index if not exists idx_candidate_passwords_email on candidate_passwords(candidate_email);

-- Triggers for updated_at
create trigger update_candidate_notes_updated_at
  before update on candidate_notes
  for each row execute function update_updated_at_column();

create trigger update_candidate_profiles_updated_at
  before update on candidate_profiles
  for each row execute function update_updated_at_column();

create trigger update_candidate_passwords_updated_at
  before update on candidate_passwords
  for each row execute function update_updated_at_column();
