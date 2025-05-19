import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';

// Types for message events
export type MessageEvent = 'new_message' | 'message_read' | 'message_delivered';

// Types for message handlers
export type MessageHandler = (message: DecryptedMessage) => void;
export type MessageErrorHandler = (error: Error) => void;

// Interface for a decrypted message
export interface DecryptedMessage {
  id: string;
  sender_id: string;
  conversation_id?: string;
  group_chat_id?: string;
  content: string;
  created_at: string;
  message_type: string;
  read_status?: 'delivered' | 'read';
}

// Raw message from the database
interface RawMessage {
  id: string;
  sender_id: string;
  conversation_id?: string;
  group_chat_id?: string;
  encrypted_content: string;
  created_at: string;
  message_type: string;
}

// Read receipt from the database
interface ReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

/**
 * Service for handling Supabase Realtime subscriptions for messaging
 */
export class RealtimeService {
  private supabase = createClient();
  private userId: string;
  private messageHandlers: Map<MessageEvent, MessageHandler[]> = new Map();
  private errorHandler: MessageErrorHandler | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private encryption: any = null;
  private initialized = false;

  /**
   * Create a new RealtimeService instance
   * @param userId The current user's ID
   */
  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize the Realtime service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize encryption for the current user
      this.encryption = await initializeEncryption(this.userId);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Realtime service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to direct messages in a conversation
   * @param conversationId The ID of the conversation to subscribe to
   * @returns A function to unsubscribe
   */
  public subscribeToConversation(conversationId: string): () => void {
    this.checkInitialized();

    const channelKey = `conversation:${conversationId}`;
    
    // Create a new channel if it doesn't exist
    if (!this.channels.has(channelKey)) {
      const channel = this.supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          this.handleNewMessage.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_read_receipts',
            filter: `message_id=in.(select id from messages where conversation_id = '${conversationId}')`,
          },
          this.handleReadReceipt.bind(this)
        )
        .subscribe();

      this.channels.set(channelKey, channel);
    }

    // Return an unsubscribe function
    return () => {
      const channel = this.channels.get(channelKey);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelKey);
      }
    };
  }

  /**
   * Subscribe to messages in a group chat
   * @param groupChatId The ID of the group chat to subscribe to
   * @returns A function to unsubscribe
   */
  public subscribeToGroupChat(groupChatId: string): () => void {
    this.checkInitialized();

    const channelKey = `group:${groupChatId}`;
    
    // Create a new channel if it doesn't exist
    if (!this.channels.has(channelKey)) {
      const channel = this.supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `group_chat_id=eq.${groupChatId}`,
          },
          this.handleNewMessage.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_read_receipts',
            filter: `message_id=in.(select id from messages where group_chat_id = '${groupChatId}')`,
          },
          this.handleReadReceipt.bind(this)
        )
        .subscribe();

      this.channels.set(channelKey, channel);
    }

    // Return an unsubscribe function
    return () => {
      const channel = this.channels.get(channelKey);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelKey);
      }
    };
  }

  /**
   * Subscribe to all conversations the user is part of
   * @returns A function to unsubscribe
   */
  public async subscribeToAllConversations(): Promise<() => void> {
    this.checkInitialized();

    // Get all conversations the user is part of
    const { data: conversations, error } = await this.supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', this.userId);

    if (error) {
      console.error('Failed to get conversations:', error);
      throw error;
    }

    // Subscribe to each conversation
    const unsubscribeFunctions: (() => void)[] = [];
    for (const conversation of conversations) {
      unsubscribeFunctions.push(this.subscribeToConversation(conversation.conversation_id));
    }

    // Return a function to unsubscribe from all conversations
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Subscribe to all group chats the user is part of
   * @returns A function to unsubscribe
   */
  public async subscribeToAllGroupChats(): Promise<() => void> {
    this.checkInitialized();

    // Get all group chats the user is part of
    const { data: groups, error } = await this.supabase
      .from('group_chat_participants')
      .select('group_chat_id')
      .eq('user_id', this.userId);

    if (error) {
      console.error('Failed to get group chats:', error);
      throw error;
    }

    // Subscribe to each group chat
    const unsubscribeFunctions: (() => void)[] = [];
    for (const group of groups) {
      unsubscribeFunctions.push(this.subscribeToGroupChat(group.group_chat_id));
    }

    // Return a function to unsubscribe from all group chats
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Mark a message as read
   * @param messageId The ID of the message to mark as read
   */
  public async markMessageAsRead(messageId: string): Promise<void> {
    this.checkInitialized();

    try {
      // Check if a read receipt already exists
      const { data: existingReceipt } = await this.supabase
        .from('message_read_receipts')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', this.userId)
        .maybeSingle();

      if (existingReceipt) {
        // Receipt already exists, no need to create a new one
        return;
      }

      // Create a new read receipt
      const { error } = await this.supabase
        .from('message_read_receipts')
        .insert({
          message_id: messageId,
          user_id: this.userId,
          read_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      throw error;
    }
  }

  /**
   * Add a handler for a specific message event
   * @param event The event to handle
   * @param handler The handler function
   */
  public on(event: MessageEvent, handler: MessageHandler): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  /**
   * Remove a handler for a specific message event
   * @param event The event to remove the handler from
   * @param handler The handler function to remove
   */
  public off(event: MessageEvent, handler: MessageHandler): void {
    if (!this.messageHandlers.has(event)) {
      return;
    }
    const handlers = this.messageHandlers.get(event)!;
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Set a handler for errors
   * @param handler The error handler function
   */
  public onError(handler: MessageErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Handle a new message event from Supabase Realtime
   * @param payload The Realtime payload
   */
  private async handleNewMessage(payload: RealtimePostgresChangesPayload<any>): Promise<void> {
    try {
      const message = payload.new as RawMessage;

      // Skip messages sent by the current user
      if (message.sender_id === this.userId) {
        return;
      }

      // Decrypt the message
      let decryptedContent: string;
      if (message.conversation_id) {
        // Direct message
        decryptedContent = await this.encryption.decryptMessage(
          message.encrypted_content,
          message.sender_id
        );
      } else if (message.group_chat_id) {
        // Group message
        decryptedContent = await this.encryption.decryptGroupMessage(
          message.group_chat_id,
          message.encrypted_content
        );
      } else {
        throw new Error('Message has neither conversation_id nor group_chat_id');
      }

      // Create a decrypted message object
      const decryptedMessage: DecryptedMessage = {
        id: message.id,
        sender_id: message.sender_id,
        conversation_id: message.conversation_id,
        group_chat_id: message.group_chat_id,
        content: decryptedContent,
        created_at: message.created_at,
        message_type: message.message_type,
        read_status: 'delivered',
      };

      // Automatically mark the message as delivered
      await this.markMessageAsRead(message.id);

      // Notify handlers
      this.notifyHandlers('new_message', decryptedMessage);
      this.notifyHandlers('message_delivered', decryptedMessage);
    } catch (error) {
      console.error('Failed to handle new message:', error);
      this.notifyError(error as Error);
    }
  }

  /**
   * Handle a read receipt event from Supabase Realtime
   * @param payload The Realtime payload
   */
  private async handleReadReceipt(payload: RealtimePostgresChangesPayload<any>): Promise<void> {
    try {
      const readReceipt = payload.new as ReadReceipt;

      // Get the message details
      const { data: message, error } = await this.supabase
        .from('messages')
        .select('*')
        .eq('id', readReceipt.message_id)
        .single();

      if (error) {
        throw error;
      }

      // Skip if the message wasn't sent by the current user
      if (message.sender_id !== this.userId) {
        return;
      }

      // Decrypt the message
      let decryptedContent: string;
      if (message.conversation_id) {
        // Direct message
        decryptedContent = await this.encryption.decryptMessage(
          message.encrypted_content,
          message.sender_id
        );
      } else if (message.group_chat_id) {
        // Group message
        decryptedContent = await this.encryption.decryptGroupMessage(
          message.group_chat_id,
          message.encrypted_content
        );
      } else {
        throw new Error('Message has neither conversation_id nor group_chat_id');
      }

      // Create a decrypted message object
      const decryptedMessage: DecryptedMessage = {
        id: message.id,
        sender_id: message.sender_id,
        conversation_id: message.conversation_id,
        group_chat_id: message.group_chat_id,
        content: decryptedContent,
        created_at: message.created_at,
        message_type: message.message_type,
        read_status: 'read',
      };

      // Notify handlers
      this.notifyHandlers('message_read', decryptedMessage);
    } catch (error) {
      console.error('Failed to handle read receipt:', error);
      this.notifyError(error as Error);
    }
  }

  /**
   * Notify all handlers for a specific event
   * @param event The event to notify handlers for
   * @param message The decrypted message
   */
  private notifyHandlers(event: MessageEvent, message: DecryptedMessage): void {
    if (!this.messageHandlers.has(event)) {
      return;
    }
    const handlers = this.messageHandlers.get(event)!;
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    }
  }

  /**
   * Notify the error handler
   * @param error The error to notify about
   */
  private notifyError(error: Error): void {
    if (this.errorHandler) {
      try {
        this.errorHandler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }
  }

  /**
   * Check if the Realtime service has been initialized
   * @throws Error if not initialized
   */
  private checkInitialized(): void {
    if (!this.initialized || !this.encryption) {
      throw new Error('Realtime service not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create and initialize a RealtimeService instance
 * @param userId The current user's ID
 * @returns Initialized RealtimeService instance
 */
export async function initializeRealtimeService(userId: string): Promise<RealtimeService> {
  const realtimeService = new RealtimeService(userId);
  await realtimeService.initialize();
  return realtimeService;
}