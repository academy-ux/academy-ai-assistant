import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Type-safe Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>

// Get Supabase URL and keys with placeholder defaults for build-time type checking
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder-key'
const anonKey = process.env.SUPABASE_ANON_KEY || ''

// Create clients with proper Database typing
export const supabase: TypedSupabaseClient = createClient<Database>(
  supabaseUrl,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export const supabaseAnon: TypedSupabaseClient | null = anonKey 
  ? createClient<Database>(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Re-export the database types for convenience
export type Interview = Database['public']['Tables']['interviews']['Row']
export type InterviewInsert = Database['public']['Tables']['interviews']['Insert']
export type InterviewUpdate = Database['public']['Tables']['interviews']['Update']
