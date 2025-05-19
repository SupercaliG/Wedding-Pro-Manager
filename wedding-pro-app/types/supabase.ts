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
      notifications: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          title: string
          content: string
          read: boolean
          channel: string | null
          status: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          title: string
          content: string
          read?: boolean
          channel?: string | null
          status?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          title?: string
          content?: string
          read?: boolean
          channel?: string | null
          status?: string | null
          metadata?: Json
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          first_name: string | null
          last_name: string | null
          email: string | null
          phone_number: string | null
          avatar_url: string | null
          role: string | null
          organization_id: string | null
          notification_preferences: Json
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone_number?: string | null
          avatar_url?: string | null
          role?: string | null
          organization_id?: string | null
          notification_preferences?: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone_number?: string | null
          avatar_url?: string | null
          role?: string | null
          organization_id?: string | null
          notification_preferences?: Json
        }
      }
      // Add other tables as needed
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}