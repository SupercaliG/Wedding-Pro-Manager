-- Migration for encrypted messaging functionality
-- This adds a table for storing group chat tickets needed for encryption

-- First, check if the group_chats table exists, and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_chats') THEN
        -- Table for Group Chats (linked to Jobs)
        CREATE TABLE group_chats (
            group_chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID REFERENCES jobs(id) ON DELETE SET NULL, -- Link to an existing jobs table
            name TEXT, -- Name of the group chat, e.g., "Job #123 Discussion"
            created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        -- Enable Row Level Security on group_chats
        ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
        
        -- Grant access to authenticated users
        GRANT SELECT ON group_chats TO authenticated;
    END IF;
END
$$;

-- Check if group_chat_participants table exists, and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_chat_participants') THEN
        -- Table for Group Chat Participants
        CREATE TABLE group_chat_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            group_chat_id UUID NOT NULL REFERENCES group_chats(group_chat_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(group_chat_id, user_id)
        );
        
        -- Enable Row Level Security
        ALTER TABLE group_chat_participants ENABLE ROW LEVEL SECURITY;
        
        -- Grant access to authenticated users
        GRANT SELECT, INSERT, UPDATE, DELETE ON group_chat_participants TO authenticated;
    END IF;
END
$$;

-- Create a table for storing group chat tickets
CREATE TABLE IF NOT EXISTS group_chat_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES group_chats(group_chat_id) ON DELETE CASCADE, -- Fixed column name reference
  ticket JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on group_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_chat_tickets_group_id ON group_chat_tickets(group_id);

-- Enable Row Level Security
ALTER TABLE group_chat_tickets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for group_chat_tickets
-- Only group participants can view tickets
CREATE POLICY "Group participants can view tickets" ON group_chat_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_participants
      WHERE group_chat_participants.group_chat_id = group_chat_tickets.group_id
      AND group_chat_participants.user_id = auth.uid()
    )
  );

-- Only group participants can insert tickets
CREATE POLICY "Group participants can insert tickets" ON group_chat_tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chat_participants
      WHERE group_chat_participants.group_chat_id = group_chat_tickets.group_id
      AND group_chat_participants.user_id = auth.uid()
    )
  );

-- Only group participants can update tickets
CREATE POLICY "Group participants can update tickets" ON group_chat_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_participants
      WHERE group_chat_participants.group_chat_id = group_chat_tickets.group_id
      AND group_chat_participants.user_id = auth.uid()
    )
  );

-- Only group participants can delete tickets
CREATE POLICY "Group participants can delete tickets" ON group_chat_tickets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_participants
      WHERE group_chat_participants.group_chat_id = group_chat_tickets.group_id
      AND group_chat_participants.user_id = auth.uid()
    )
  );

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON group_chat_tickets TO authenticated;