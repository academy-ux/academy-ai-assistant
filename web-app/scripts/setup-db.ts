// Run with: npx tsx --env-file=.env.local scripts/setup-db.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  console.error('Run with: npx tsx --env-file=.env.local scripts/setup-db.ts')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('Checking database setup...')
  console.log('Supabase URL:', supabaseUrl)
  
  // Check if interviews table exists
  const { data, error } = await supabase
    .from('interviews')
    .select('id')
    .limit(1)
  
  if (error?.code === 'PGRST205') {
    console.log('\n❌ Table "interviews" does not exist.\n')
    console.log('Please go to your Supabase Dashboard SQL Editor and run:\n')
    console.log('URL: https://supabase.com/dashboard/project/ebycqbmyqhejnimerzsy/sql/new\n')
    console.log(`
-- Enable the vector extension
create extension if not exists vector;

-- Create the interviews table
create table public.interviews (
  id uuid default gen_random_uuid() primary key,
  meeting_title text,
  meeting_date timestamp with time zone,
  transcript text,
  transcript_file_name text,
  embedding vector(768),
  summary text,
  rating text,
  candidate_name text,
  position text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.interviews enable row level security;

-- Allow all operations (for development)
create policy "Allow all operations" on public.interviews
  for all using (true) with check (true);
    `)
  } else if (error) {
    console.log('Error checking table:', error.message)
  } else {
    console.log('✅ Table "interviews" exists!')
    console.log('Found', data?.length || 0, 'rows (limited to 1)')
  }
}

checkDatabase().catch(console.error)
