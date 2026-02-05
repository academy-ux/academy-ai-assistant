export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
        Relationships: []
      }
      candidate_notes: {
        Row: {
          id: string
          candidate_email: string
          content: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          candidate_email: string
          content: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          candidate_email?: string
          content?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          id: string
          candidate_email: string
          pitch: string | null
          salary_expectations: string | null
          years_of_experience: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_email: string
          pitch?: string | null
          salary_expectations?: string | null
          years_of_experience?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_email?: string
          pitch?: string | null
          salary_expectations?: string | null
          years_of_experience?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_passwords: {
        Row: {
          id: string
          candidate_email: string
          password: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_email: string
          password?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_email?: string
          password?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          candidate_id: string | null
          candidate_name: string | null
          candidate_email: string | null
          created_at: string | null
          drive_file_id: string | null
          embedding: number[] | null
          id: string
          interviewer: string | null
          meeting_code: string | null
          meeting_date: string | null
          meeting_title: string | null
          meeting_type: string | null
          owner_email: string | null
          position: string | null
          rating: string | null
          submitted_at: string | null
          summary: string | null
          transcript: string
          transcript_file_name: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_email?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          embedding?: number[] | null
          id?: string
          interviewer?: string | null
          meeting_code?: string | null
          meeting_date?: string | null
          meeting_title?: string | null
          meeting_type?: string | null
          owner_email?: string | null
          position?: string | null
          rating?: string | null
          submitted_at?: string | null
          summary?: string | null
          transcript: string
          transcript_file_name?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_email?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          embedding?: number[] | null
          id?: string
          interviewer?: string | null
          meeting_code?: string | null
          meeting_date?: string | null
          meeting_title?: string | null
          meeting_type?: string | null
          owner_email?: string | null
          position?: string | null
          rating?: string | null
          submitted_at?: string | null
          summary?: string | null
          transcript?: string
          transcript_file_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_poll_enabled: boolean | null
          created_at: string | null
          drive_folder_id: string | null
          folder_name: string | null
          id: string
          last_poll_file_count: number | null
          last_poll_time: string | null
          poll_interval_minutes: number | null
          updated_at: string | null
          user_email: string
        }
        Insert: {
          auto_poll_enabled?: boolean | null
          created_at?: string | null
          drive_folder_id?: string | null
          folder_name?: string | null
          id?: string
          last_poll_file_count?: number | null
          last_poll_time?: string | null
          poll_interval_minutes?: number | null
          updated_at?: string | null
          user_email: string
        }
        Update: {
          auto_poll_enabled?: boolean | null
          created_at?: string | null
          drive_folder_id?: string | null
          folder_name?: string | null
          id?: string
          last_poll_file_count?: number | null
          last_poll_time?: string | null
          poll_interval_minutes?: number | null
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_interviews: {
        Args: {
          filter_types?: string[] | null
          match_count: number
          match_threshold: number
          query_embedding: number[]
        }
        Returns: {
          candidate_name: string
          created_at: string
          id: string
          meeting_title: string
          meeting_type: string
          position: string
          similarity: number
          transcript: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
