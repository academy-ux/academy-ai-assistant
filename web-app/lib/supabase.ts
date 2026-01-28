import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required')
}

// Service client for server-side operations (bypasses RLS)
// Use only in API routes protected by NextAuth middleware
const serviceKey = process.env.SUPABASE_SERVICE_KEY
if (!serviceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required')
}

export const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Anon client for operations that should respect RLS
// Use when you want row-level security to apply
const anonKey = process.env.SUPABASE_ANON_KEY
export const supabaseAnon: SupabaseClient | null = anonKey 
  ? createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export interface Interview {
  id: string
  created_at: string
  updated_at?: string
  meeting_code: string | null
  meeting_title: string | null
  meeting_date: string | null
  candidate_id: string | null
  candidate_name: string | null
  candidate_email: string | null
  position: string | null
  interviewer: string | null
  transcript: string
  transcript_file_name: string | null
  rating: string | null
  summary: string | null
  embedding?: number[]
}

export type InterviewInsert = Omit<Interview, 'id' | 'created_at' | 'updated_at'>
