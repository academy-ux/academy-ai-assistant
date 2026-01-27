import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Interview {
  id: string
  created_at: string
  meeting_code: string | null
  meeting_title: string | null
  meeting_date: string | null
  candidate_id: string | null
  candidate_name: string | null
  candidate_email: string | null
  position: string | null
  transcript: string
  transcript_file_name: string | null
  rating: string | null
  summary: string | null
  embedding?: number[]
}

export type InterviewInsert = Omit<Interview, 'id' | 'created_at'>
