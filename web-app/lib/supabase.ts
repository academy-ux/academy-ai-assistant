import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabase: SupabaseClient | null = null
let _supabaseAnon: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase
  
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is required')
  }
  
  _supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  return _supabase
}

function getSupabaseAnonClient(): SupabaseClient | null {
  if (_supabaseAnon) return _supabaseAnon
  
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !anonKey) return null
  
  _supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  return _supabaseAnon
}

// Export getters that lazily initialize the clients
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as any)[prop]
  }
})

export const supabaseAnon: SupabaseClient | null = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseAnonClient()
    return client ? (client as any)[prop] : null
  }
})

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
