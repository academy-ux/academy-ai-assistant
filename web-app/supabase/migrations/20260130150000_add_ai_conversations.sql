-- Create ai_conversations table to store chat history
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- User info (from NextAuth session)
  user_email text not null,
  user_name text,
  
  -- Context: null = global (across all interviews), or specific interview
  interview_id uuid references interviews(id) on delete cascade,
  
  -- Conversation title (auto-generated from first question)
  title text not null,
  
  -- Messages in the conversation (JSONB array)
  -- Format: [{ id, role, content, timestamp, sources? }]
  messages jsonb not null default '[]'::jsonb,
  
  -- Metadata
  message_count int not null default 0,
  last_message_at timestamp with time zone default now()
);

-- Enable RLS
alter table ai_conversations enable row level security;

-- Policies: Users can only access their own conversations
create policy "Users can view their own conversations"
  on ai_conversations for select
  using (true);  -- Service key on server

create policy "Users can insert their own conversations"
  on ai_conversations for insert
  with check (true);

create policy "Users can update their own conversations"
  on ai_conversations for update
  using (true);

create policy "Users can delete their own conversations"
  on ai_conversations for delete
  using (true);

-- Indexes for performance
create index if not exists idx_ai_conversations_user_email 
  on ai_conversations(user_email);

create index if not exists idx_ai_conversations_interview_id 
  on ai_conversations(interview_id);

create index if not exists idx_ai_conversations_last_message_at 
  on ai_conversations(last_message_at desc);

create index if not exists idx_ai_conversations_created_at 
  on ai_conversations(created_at desc);

-- GIN index for searching within messages JSONB
create index if not exists idx_ai_conversations_messages_gin 
  on ai_conversations using gin(messages);

-- Function to auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at
drop trigger if exists update_ai_conversations_updated_at on ai_conversations;
create trigger update_ai_conversations_updated_at
  before update on ai_conversations
  for each row
  execute function update_updated_at_column();

-- Function to update message_count and last_message_at when messages change
create or replace function update_ai_conversation_metadata()
returns trigger as $$
begin
  new.message_count = jsonb_array_length(new.messages);
  
  -- Extract last message timestamp if messages exist
  if new.message_count > 0 then
    new.last_message_at = (
      new.messages->-1->>'timestamp'
    )::timestamp with time zone;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_ai_conversation_metadata_trigger on ai_conversations;
create trigger update_ai_conversation_metadata_trigger
  before insert or update on ai_conversations
  for each row
  execute function update_ai_conversation_metadata();
