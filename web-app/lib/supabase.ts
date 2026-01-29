import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Type-safe Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabase: TypedSupabaseClient | null = null
let _supabaseAnon: TypedSupabaseClient | null = null

function getSupabaseClient(): TypedSupabaseClient {
  if (_supabase) return _supabase
  
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is required')
  }
  
  _supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  return _supabase
}

function getSupabaseAnonClient(): TypedSupabaseClient | null {
  if (_supabaseAnon) return _supabaseAnon
  
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !anonKey) return null
  
  _supabaseAnon = createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  return _supabaseAnon
}

// Export getters that lazily initialize the clients
export const supabase: TypedSupabaseClient = new Proxy({} as TypedSupabaseClient, {
  get(_, prop) {
    return (getSupabaseClient() as any)[prop]
  }
})

export const supabaseAnon: TypedSupabaseClient | null = new Proxy({} as TypedSupabaseClient, {
  get(_, prop) {
    const client = getSupabaseAnonClient()
    return client ? (client as any)[prop] : null
  }
})

// Re-export the database types for convenience
export type Interview = Database['public']['Tables']['interviews']['Row']
export type InterviewInsert = Database['public']['Tables']['interviews']['Insert']
export type InterviewUpdate = Database['public']['Tables']['interviews']['Update']
