-- Migration for enabling Supabase Realtime on messaging tables
-- This configures Realtime for the messaging tables and sets up RLS policies

-- First, create the necessary tables if they don't exist

-- Create conversations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        CREATE TABLE conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        -- Enable Row Level Security
        ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Create conversation_participants table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_participants') THEN
        CREATE TABLE conversation_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(conversation_id, user_id)
        );
        
        -- Enable Row Level Security
        ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Create messages table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
            group_chat_id UUID REFERENCES group_chats(group_chat_id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT,
            encrypted_content TEXT,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT conversation_or_group_chat CHECK (
                (conversation_id IS NOT NULL AND group_chat_id IS NULL) OR
                (conversation_id IS NULL AND group_chat_id IS NOT NULL)
            )
        );
        
        -- Enable Row Level Security
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Create message_read_receipts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts') THEN
        CREATE TABLE message_read_receipts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(message_id, user_id)
        );
        
        -- Enable Row Level Security
        ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Create RLS policies for conversation_participants
DO $$
BEGIN
    -- Only create policies if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_participants') THEN
        -- Policy for viewing conversation participants
        DROP POLICY IF EXISTS "Users can view their conversation participants" ON conversation_participants;
        CREATE POLICY "Users can view their conversation participants" ON conversation_participants
            FOR SELECT
            USING (user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM conversation_participants cp
                WHERE cp.conversation_id = conversation_participants.conversation_id
                AND cp.user_id = auth.uid()
            ));
        
        -- Policy for inserting conversation participants
        DROP POLICY IF EXISTS "Users can add participants to their conversations" ON conversation_participants;
        CREATE POLICY "Users can add participants to their conversations" ON conversation_participants
            FOR INSERT
            WITH CHECK (EXISTS (
                SELECT 1 FROM conversation_participants cp
                WHERE cp.conversation_id = conversation_participants.conversation_id
                AND cp.user_id = auth.uid()
            ));
    END IF;
END
$$;

-- Create RLS policies for conversations
DO $$
BEGIN
    -- Only create policies if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        -- Policy for viewing conversations
        DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
        CREATE POLICY "Users can view their conversations" ON conversations
            FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM conversation_participants
                WHERE conversation_participants.conversation_id = conversations.id
                AND conversation_participants.user_id = auth.uid()
            ));
    END IF;
END
$$;

-- Now enable Realtime for the tables
DO $$
BEGIN
    -- Only add tables to publication if they exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        -- Enable Realtime for the messages table
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts') THEN
        -- Enable Realtime for the message_read_receipts table
        ALTER PUBLICATION supabase_realtime ADD TABLE message_read_receipts;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        -- Enable Realtime for the conversations table
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_chats') THEN
        -- Enable Realtime for the group_chats table
        ALTER PUBLICATION supabase_realtime ADD TABLE group_chats;
    END IF;
END
$$;

-- Create or update RLS policies for the messages table
-- These policies ensure that only authorized users can access messages
DO $$
BEGIN
    -- Only create policies if the table exists AND has the required columns
    IF EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages'
    ) AND EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id'
    ) AND EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'group_chat_id'
    ) AND EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_id'
    ) THEN
        -- Policy for selecting messages: Users can only see messages in conversations they're part of
        DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
        CREATE POLICY "Users can view messages in their conversations" ON messages
          FOR SELECT
          USING (
            (
              -- Direct messages in conversations the user is part of
              conversation_id IS NOT NULL AND
              EXISTS (
                SELECT 1 FROM conversation_participants
                WHERE conversation_participants.conversation_id = messages.conversation_id
                AND conversation_participants.user_id = auth.uid()
              )
            ) OR (
              -- Group messages in group chats the user is part of
              group_chat_id IS NOT NULL AND
              EXISTS (
                SELECT 1 FROM group_chat_participants
                WHERE group_chat_participants.group_chat_id = messages.group_chat_id
                AND group_chat_participants.user_id = auth.uid()
              )
            )
          );

        -- Policy for inserting messages: Users can only send messages to conversations they're part of
        DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;
        CREATE POLICY "Users can send messages to their conversations" ON messages
          FOR INSERT
          WITH CHECK (
            (
              -- Direct messages in conversations the user is part of
              conversation_id IS NOT NULL AND
              EXISTS (
                SELECT 1 FROM conversation_participants
                WHERE conversation_participants.conversation_id = messages.conversation_id
                AND conversation_participants.user_id = auth.uid()
              )
            ) OR (
              -- Group messages in group chats the user is part of
              group_chat_id IS NOT NULL AND
              EXISTS (
                SELECT 1 FROM group_chat_participants
                WHERE group_chat_participants.group_chat_id = messages.group_chat_id
                AND group_chat_participants.user_id = auth.uid()
              )
            )
          );

        -- Policy for updating messages: Users can only update their own messages
        DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
        CREATE POLICY "Users can update their own messages" ON messages
          FOR UPDATE
          USING (sender_id = auth.uid());

        -- Policy for deleting messages: Users can only delete their own messages
        DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
        CREATE POLICY "Users can delete their own messages" ON messages
          FOR DELETE
          USING (sender_id = auth.uid());
    END IF;
END
$$;

-- Create or update RLS policies for the message_read_receipts table
DO $$
BEGIN
    -- Only create policies if the table exists AND has the required columns
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts')
       AND EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'message_read_receipts' AND column_name = 'message_id')
       AND EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'message_read_receipts' AND column_name = 'user_id')
       AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages')
       AND EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id')
       AND EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'group_chat_id') THEN
        -- Policy for selecting read receipts: Users can see read receipts for messages they can see
        DROP POLICY IF EXISTS "Users can view read receipts for their messages" ON message_read_receipts;
        CREATE POLICY "Users can view read receipts for their messages" ON message_read_receipts
          FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM messages
              WHERE messages.id = message_read_receipts.message_id
              AND (
                -- Messages in conversations the user is part of
                (
                  messages.conversation_id IS NOT NULL AND
                  EXISTS (
                    SELECT 1 FROM conversation_participants
                    WHERE conversation_participants.conversation_id = messages.conversation_id
                    AND conversation_participants.user_id = auth.uid()
                  )
                ) OR (
                  -- Messages in group chats the user is part of
                  messages.group_chat_id IS NOT NULL AND
                  EXISTS (
                    SELECT 1 FROM group_chat_participants
                    WHERE group_chat_participants.group_chat_id = messages.group_chat_id
                    AND group_chat_participants.user_id = auth.uid()
                  )
                )
              )
            )
          );

        -- Policy for inserting read receipts: Users can only mark messages as read if they can see them
        DROP POLICY IF EXISTS "Users can mark messages as read" ON message_read_receipts;
        CREATE POLICY "Users can mark messages as read" ON message_read_receipts
          FOR INSERT
          WITH CHECK (
            -- Only the current user can create read receipts for themselves
            user_id = auth.uid() AND
            EXISTS (
              SELECT 1 FROM messages
              WHERE messages.id = message_read_receipts.message_id
              AND (
                -- Messages in conversations the user is part of
                (
                  messages.conversation_id IS NOT NULL AND
                  EXISTS (
                    SELECT 1 FROM conversation_participants
                    WHERE conversation_participants.conversation_id = messages.conversation_id
                    AND conversation_participants.user_id = auth.uid()
                  )
                ) OR (
                  -- Messages in group chats the user is part of
                  messages.group_chat_id IS NOT NULL AND
                  EXISTS (
                    SELECT 1 FROM group_chat_participants
                    WHERE group_chat_participants.group_chat_id = messages.group_chat_id
                    AND group_chat_participants.user_id = auth.uid()
                  )
                )
              )
            )
          );

        -- Policy for updating read receipts: Users can only update their own read receipts
        DROP POLICY IF EXISTS "Users can update their own read receipts" ON message_read_receipts;
        CREATE POLICY "Users can update their own read receipts" ON message_read_receipts
          FOR UPDATE
          USING (user_id = auth.uid());

        -- Policy for deleting read receipts: Users can only delete their own read receipts
        DROP POLICY IF EXISTS "Users can delete their own read receipts" ON message_read_receipts;
        CREATE POLICY "Users can delete their own read receipts" ON message_read_receipts
          FOR DELETE
          USING (user_id = auth.uid());
    END IF;
END
$$;

-- Create a function to get or create a conversation between two users
-- This is used to ensure that there's only one conversation between any two users
DO $$
BEGIN
    -- Only create function if the necessary tables exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations')
       AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_participants') THEN
        
        CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
        RETURNS TABLE (id UUID) AS $function$
        DECLARE
          existing_conversation_id UUID;
          new_conversation_id UUID;
        BEGIN
          -- Check if a conversation already exists between these users
          SELECT c.id INTO existing_conversation_id
          FROM conversations c
          JOIN conversation_participants p1 ON c.id = p1.conversation_id
          JOIN conversation_participants p2 ON c.id = p2.conversation_id
          WHERE p1.user_id = user1_id AND p2.user_id = user2_id;
          
          -- If a conversation exists, return it
          IF existing_conversation_id IS NOT NULL THEN
            RETURN QUERY SELECT existing_conversation_id;
            RETURN;
          END IF;
          
          -- Otherwise, create a new conversation
          INSERT INTO conversations DEFAULT VALUES
          RETURNING id INTO new_conversation_id;
          
          -- Add both users as participants
          INSERT INTO conversation_participants (conversation_id, user_id)
          VALUES
            (new_conversation_id, user1_id),
            (new_conversation_id, user2_id);
          
          -- Return the new conversation ID
          RETURN QUERY SELECT new_conversation_id;
        END;
        $function$ LANGUAGE plpgsql SECURITY DEFINER;
        
        -- Grant execute permission on the function
        GRANT EXECUTE ON FUNCTION get_or_create_conversation TO authenticated;
    END IF;
END
$$;

-- Create a trigger to automatically mark messages as delivered when they're inserted
DO $$
BEGIN
    -- Only create trigger if the necessary tables exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages')
       AND EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts') THEN
        
        -- Create the trigger function
        CREATE OR REPLACE FUNCTION mark_message_delivered()
        RETURNS TRIGGER AS $trigger$
        BEGIN
          -- When a new message is inserted, mark it as delivered to the sender
          -- This ensures that the sender always has a delivery receipt for their own messages
          INSERT INTO message_read_receipts (message_id, user_id, read_at)
          VALUES (NEW.id, NEW.sender_id, NOW());
          
          RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Create the trigger on the messages table
        DROP TRIGGER IF EXISTS message_delivered_trigger ON messages;
        CREATE TRIGGER message_delivered_trigger
        AFTER INSERT ON messages
        FOR EACH ROW
        EXECUTE FUNCTION mark_message_delivered();
    END IF;
END
$$;

-- Grant necessary permissions to authenticated users
DO $$
BEGIN
    -- Grant permissions only if tables exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_receipts') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON message_read_receipts TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        GRANT SELECT ON conversations TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_chats') THEN
        GRANT SELECT ON group_chats TO authenticated;
    END IF;
END
$$;