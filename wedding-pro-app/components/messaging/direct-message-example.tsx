'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DirectMessageContainer } from './direct-message-container';

interface DirectMessageExampleProps {
  userId: string;
  recipientId?: string;
}

/**
 * Example component demonstrating how to use the DirectMessageContainer
 * This handles setting up a conversation between two users
 */
export function DirectMessageExample({
  userId,
  recipientId,
}: DirectMessageExampleProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<{ id: string; name: string } | null>(null);
  const supabase = createClient();

  // Get or create a conversation with the recipient
  useEffect(() => {
    const setupConversation = async () => {
      if (!recipientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get recipient details
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', recipientId)
          .single();

        if (userError) {
          throw userError;
        }

        setRecipient({
          id: userData.id,
          name: userData.full_name || 'Unknown User',
        });

        // Get or create a conversation between the users
        const { data: conversationData, error: conversationError } = await supabase
          .rpc('get_or_create_conversation', {
            user1_id: userId,
            user2_id: recipientId,
          });

        if (conversationError) {
          throw conversationError;
        }

        setConversationId(conversationData[0].id);
        setLoading(false);
      } catch (err) {
        console.error('Failed to set up conversation:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    setupConversation();
  }, [userId, recipientId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] w-full max-w-md mx-auto border rounded-lg bg-white shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Setting up conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] w-full max-w-md mx-auto border rounded-lg bg-white shadow-md">
        <div className="text-center text-red-500">
          <p className="font-semibold">Error setting up conversation</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!recipientId || !conversationId || !recipient) {
    return (
      <div className="flex items-center justify-center h-[600px] w-full max-w-md mx-auto border rounded-lg bg-white shadow-md">
        <div className="text-center text-gray-500">
          <p>Please select a recipient to start a conversation.</p>
        </div>
      </div>
    );
  }

  return (
    <DirectMessageContainer
      userId={userId}
      conversationId={conversationId}
      recipientId={recipient.id}
      recipientName={recipient.name}
    />
  );
}