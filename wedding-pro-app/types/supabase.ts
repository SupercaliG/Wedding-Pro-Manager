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
      org_announcements: {
        Row: {
          id: string
          org_id: string
          user_id: string
          title: string
          content: string
          is_active: boolean
          pinned_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          title: string
          content: string
          is_active?: boolean
          pinned_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          title?: string
          content?: string
          is_active?: boolean
          pinned_until?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      announcement_engagements: {
        Row: {
          id: string
          announcement_id: string
          user_id: string
          engagement_type: string
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          announcement_id: string
          user_id: string
          engagement_type: string
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          announcement_id?: string
          user_id?: string
          engagement_type?: string
          created_at?: string
          metadata?: Json
        }
      }
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
      announcement_analytics: {
        Row: {
          announcement_id: string
          title: string
          org_id: string
          is_active: boolean
          pinned_until: string | null
          created_at: string
          updated_at: string
          view_count: number
          dismiss_count: number
          click_count: number
          click_through_rate: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}