-- User settings table for storing Drive folder polling configuration
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- User identification (from NextAuth)
  user_email text unique not null,
  
  -- Drive folder polling settings
  drive_folder_id text,
  auto_poll_enabled boolean default false,
  poll_interval_minutes integer default 15,
  last_poll_time timestamp with time zone,
  
  -- Metadata
  folder_name text,
  last_poll_file_count integer default 0
);

-- Enable RLS
alter table user_settings enable row level security;

-- Policies
create policy "Allow authenticated read access"
  on user_settings for select
  using (true);

create policy "Allow authenticated insert access"
  on user_settings for insert
  with check (true);

create policy "Allow authenticated update access"
  on user_settings for update
  using (true);

create policy "Allow authenticated delete access"
  on user_settings for delete
  using (true);

-- Index
create index if not exists idx_user_settings_email 
  on user_settings(user_email);

-- Trigger for updated_at
drop trigger if exists update_user_settings_updated_at on user_settings;
create trigger update_user_settings_updated_at
  before update on user_settings
  for each row
  execute function update_updated_at_column();

-- Comments
comment on table user_settings is 'Stores user-specific settings including Drive folder polling configuration';
comment on column user_settings.drive_folder_id is 'Google Drive folder ID to poll for new transcripts';
comment on column user_settings.auto_poll_enabled is 'Whether to automatically poll the Drive folder for new files';
comment on column user_settings.poll_interval_minutes is 'How often to poll in minutes (default: 15)';
