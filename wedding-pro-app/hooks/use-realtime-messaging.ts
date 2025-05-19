'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';
import { 
  RealtimeService, 
  DecryptedMessage, 
  MessageEvent,
  initializeRealtimeService
} from '@/utils/messaging/realtime-service';

// Types for the hook
export interface UseRealtimeMessagingProps {
  userId: string;
  conversationId?: string;
  groupChatId?: string;
}

export interface UseRealtimeMessagingResult {
  messages: DecryptedMessage[];
  loading: boolean;
  error: Error | null;
  sendMessage: (content: string, messageType?: string) => Promise<string>;
  markAsRead: (messageId: string) => Promise<void>;
  subscribeToEvent: (event: MessageEvent, handler: (message: DecryptedMessage) => void) => void;
  unsubscribeFromEvent: (event: MessageEvent, handler: (message: DecryptedMessage) => void) => void;
}

/**
 * Hook for using Realtime messaging in a component
 * @param props The hook props
 * @returns The hook result
 */
export function useRealtimeMessaging({
  userId,
  conversationId,
  groupChatId,
}: UseRealtimeMessagingProps): UseRealtimeMessagingResult {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [realtimeService, setRealtimeService] = useState<RealtimeService | null>(null);
  const [encryption, setEncryption] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();
  
  // Use refs to store the unsubscribe functions
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Initialize the Realtime service and encryption
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        setLoading(true);
        
        // Initialize encryption
        const encryptionInstance = await initializeEncryption(userId);
        if (isMounted) setEncryption(encryptionInstance);
        
        // Initialize Realtime service
        const realtimeInstance = await initializeRealtimeService(userId);
        if (isMounted) setRealtimeService(realtimeInstance);
        
        // Set up error handler
        realtimeInstance.onError((err) => {
          if (isMounted) setError(err);
        });
        
        // Load initial messages
        if (conversationId || groupChatId) {
          await loadInitialMessages();
        }
        
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('Failed to initialize messaging:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      // Clean up subscriptions
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]);
  
  // Subscribe to the conversation or group chat when they change
  useEffect(() => {
    if (!realtimeService || (!conversationId && !groupChatId)) {
      return;
    }
    
    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Set up new message handler
    const handleNewMessage = (message: DecryptedMessage) => {
      setMessages(prevMessages => {
        // Check if the message already exists
        const exists = prevMessages.some(m => m.id === message.id);
        if (exists) {
          return prevMessages;
        }
        // Add the new message
        return [...prevMessages, message].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    };
    
    // Subscribe to new messages
    realtimeService.on('new_message', handleNewMessage);
    
    // Subscribe to the appropriate channel
    if (conversationId) {
      unsubscribeRef.current = realtimeService.subscribeToConversation(conversationId);
    } else if (groupChatId) {
      unsubscribeRef.current = realtimeService.subscribeToGroupChat(groupChatId);
    }
    
    // Load initial messages
    loadInitialMessages();
    
    return () => {
      // Clean up
      realtimeService.off('new_message', handleNewMessage);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [realtimeService, conversationId, groupChatId]);
  
  /**
   * Load initial messages for the conversation or group chat
   */
  const loadInitialMessages = async () => {
    if (!encryption || (!conversationId && !groupChatId)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Query for messages
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      // Filter by conversation or group chat
      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      } else if (groupChatId) {
        query = query.eq('group_chat_id', groupChatId);
      }
      
      // Execute the query
      const { data: rawMessages, error: messagesError } = await query;
      
      if (messagesError) {
        throw messagesError;
      }
      
      // Decrypt the messages
      const decryptedMessages: DecryptedMessage[] = await Promise.all(
        rawMessages.map(async (message) => {
          try {
            // Decrypt the message content
            let content: string;
            if (message.conversation_id) {
              content = await encryption.decryptMessage(
                message.encrypted_content,
                message.sender_id
              );
            } else if (message.group_chat_id) {
              content = await encryption.decryptGroupMessage(
                message.group_chat_id,
                message.encrypted_content
              );
            } else {
              throw new Error('Message has neither conversation_id nor group_chat_id');
            }
            
            // Get read status
            let readStatus: 'delivered' | 'read' | undefined;
            
            // Check if the message has been read by the current user
            if (message.sender_id !== userId) {
              const { data: readReceipt } = await supabase
                .from('message_read_receipts')
                .select('read_at')
                .eq('message_id', message.id)
                .eq('user_id', userId)
                .maybeSingle();
              
              readStatus = readReceipt ? 'read' : 'delivered';
              
              // If the message hasn't been marked as read yet, mark it now
              if (!readReceipt && realtimeService) {
                await realtimeService.markMessageAsRead(message.id);
              }
            }
            
            return {
              id: message.id,
              sender_id: message.sender_id,
              conversation_id: message.conversation_id,
              group_chat_id: message.group_chat_id,
              content,
              created_at: message.created_at,
              message_type: message.message_type,
              read_status: readStatus,
            };
          } catch (error) {
            console.error(`Failed to decrypt message ${message.id}:`, error);
            // Return a placeholder for messages that couldn't be decrypted
            return {
              id: message.id,
              sender_id: message.sender_id,
              conversation_id: message.conversation_id,
              group_chat_id: message.group_chat_id,
              content: '[Encrypted message could not be decrypted]',
              created_at: message.created_at,
              message_type: message.message_type,
            };
          }
        })
      );
      
      setMessages(decryptedMessages);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  };
  
  /**
   * Send a message to the conversation or group chat
   * @param content The message content
   * @param messageType The message type (default: 'text')
   * @returns The ID of the sent message
   */
  const sendMessage = useCallback(async (
    content: string,
    messageType: string = 'text'
  ): Promise<string> => {
    if (!encryption || (!conversationId && !groupChatId)) {
      throw new Error('Cannot send message: No conversation or group chat specified');
    }
    
    try {
      // Encrypt the message
      let encryptedContent: string;
      
      if (conversationId) {
        // Get the recipient ID
        const { data: participants, error: participantsError } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', userId);
        
        if (participantsError) {
          throw participantsError;
        }
        
        if (!participants || participants.length === 0) {
          throw new Error('No recipients found for this conversation');
        }
        
        const recipientId = participants[0].user_id;
        
        // Encrypt for direct message
        encryptedContent = await encryption.encryptMessage(content, [recipientId]);
      } else if (groupChatId) {
        // Encrypt for group chat
        encryptedContent = await encryption.encryptGroupMessage(groupChatId, content);
      } else {
        throw new Error('No conversation or group chat specified');
      }
      
      // Insert the message into the database
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          conversation_id: conversationId,
          group_chat_id: groupChatId,
          encrypted_content: encryptedContent,
          message_type: messageType,
        })
        .select()
        .single();
      
      if (messageError) {
        throw messageError;
      }
      
      // Add the message to the local state
      const decryptedMessage: DecryptedMessage = {
        id: message.id,
        sender_id: userId,
        conversation_id: message.conversation_id,
        group_chat_id: message.group_chat_id,
        content,
        created_at: message.created_at,
        message_type: messageType,
      };
      
      setMessages(prevMessages => [...prevMessages, decryptedMessage]);
      
      // Refresh the page to trigger a revalidation
      router.refresh();
      
      return message.id;
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [encryption, userId, conversationId, groupChatId, supabase, router]);
  
  /**
   * Mark a message as read
   * @param messageId The ID of the message to mark as read
   */
  const markAsRead = useCallback(async (messageId: string): Promise<void> => {
    if (!realtimeService) {
      throw new Error('Realtime service not initialized');
    }
    
    try {
      await realtimeService.markMessageAsRead(messageId);
      
      // Update the local state
      setMessages(prevMessages =>
        prevMessages.map(message =>
          message.id === messageId
            ? { ...message, read_status: 'read' }
            : message
        )
      );
    } catch (err) {
      console.error('Failed to mark message as read:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [realtimeService]);
  
  /**
   * Subscribe to a message event
   * @param event The event to subscribe to
   * @param handler The handler function
   */
  const subscribeToEvent = useCallback((
    event: MessageEvent,
    handler: (message: DecryptedMessage) => void
  ): void => {
    if (!realtimeService) {
      console.warn('Realtime service not initialized, event subscription will be ignored');
      return;
    }
    
    realtimeService.on(event, handler);
  }, [realtimeService]);
  
  /**
   * Unsubscribe from a message event
   * @param event The event to unsubscribe from
   * @param handler The handler function
   */
  const unsubscribeFromEvent = useCallback((
    event: MessageEvent,
    handler: (message: DecryptedMessage) => void
  ): void => {
    if (!realtimeService) {
      return;
    }
    
    realtimeService.off(event, handler);
  }, [realtimeService]);
  
  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    subscribeToEvent,
    unsubscribeFromEvent,
  };
}