export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          id: string
          user_email: string
          user_name: string | null
          interview_id: string | null
          title: string
          messages: Json
          message_count: number
          created_at: string
          updated_at: string
          last_message_at: string
        }
        Insert: {
          id?: string
          user_email: string
          user_name?: string | null
          interview_id?: string | null
          title: string
          messages: Json
          message_count?: number
          created_at?: string
          updated_at?: string
          last_message_at?: string
        }
        Update: {
          id?: string
          user_email?: string
          user_name?: string | null
          interview_id?: string | null
          title?: string
          messages?: Json
          message_count?: number
          created_at?: string
          updated_at?: string
          last_message_at?: string
        }
      }
      interviews: {
        Row: {
          id: string
          created_at: string | null
          updated_at: string | null
          meeting_code: string | null
          meeting_title: string | null
          meeting_date: string | null
          candidate_id: string | null
          candidate_name: string | null
          candidate_email: string | null
          owner_email: string | null
          position: string | null
          interviewer: string | null
          submitted_at: string | null
          transcript: string
          transcript_file_name: string | null
          drive_file_id: string | null
          rating: string | null
          summary: string | null
          embedding: number[] | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          meeting_code?: string | null
          meeting_title?: string | null
          meeting_date?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_email?: string | null
          position?: string | null
          interviewer?: string | null
          submitted_at?: string | null
          transcript: string
          transcript_file_name?: string | null
          drive_file_id?: string | null
          rating?: string | null
          summary?: string | null
          embedding?: number[] | null
        }
        Update: {
          id?: string
          created_at?: string | null
          updated_at?: string | null
          meeting_code?: string | null
          meeting_title?: string | null
          meeting_date?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_email?: string | null
          position?: string | null
          interviewer?: string | null
          submitted_at?: string | null
          transcript?: string
          transcript_file_name?: string | null
          drive_file_id?: string | null
          rating?: string | null
          summary?: string | null
          embedding?: number[] | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_interviews: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          created_at: string
          meeting_title: string
          candidate_name: string
          position: string
          transcript: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
