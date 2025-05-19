# Supabase Realtime Messaging Integration

This directory contains the implementation of Supabase Realtime integration for the encrypted messaging system in the Wedding Pro application. The integration enables instant message delivery and read receipts for both direct messages and group chats.

## Overview

The Realtime messaging integration provides:

- Real-time message delivery for direct messages and group chats
- Message delivery status tracking (delivered, read)
- Encrypted message content using Virgil Security's E3Kit
- Optimized Realtime subscriptions to minimize costs

## Files

- `realtime-service.ts`: Core Realtime functionality for subscribing to message events
- `../hooks/use-realtime-messaging.ts`: React hook for using Realtime messaging in components
- `../../components/messaging/messaging-example.tsx`: Example component demonstrating usage
- `../../scripts/realtime-messaging-config.sql`: SQL migration for enabling Realtime

## Backend Setup

### 1. Enable Realtime in Supabase Project Settings

1. Log in to your Supabase dashboard
2. Navigate to your project
3. Go to **Database** > **Replication**
4. Under **Realtime**, enable the following tables:
   - `messages`
   - `message_read_receipts`
   - `conversations`
   - `group_chats`
5. Save your changes

### 2. Apply the SQL Migration

Apply the SQL migration to configure Realtime and set up the necessary RLS policies:

```bash
cd wedding-pro-app
npx supabase db push
```

Or manually run the SQL commands in `scripts/realtime-messaging-config.sql` in the SQL editor in the Supabase dashboard.

## Usage

### Initializing the Realtime Service

Before using Realtime messaging, you need to initialize the service for the current user:

```typescript
import { initializeRealtimeService } from '@/utils/messaging/realtime-service';

// Initialize the Realtime service for the current user
const realtimeService = await initializeRealtimeService(currentUserId);
```

### Subscribing to Conversations or Group Chats

```typescript
// Subscribe to a specific conversation
const unsubscribeConversation = realtimeService.subscribeToConversation(conversationId);

// Subscribe to a specific group chat
const unsubscribeGroupChat = realtimeService.subscribeToGroupChat(groupChatId);

// Subscribe to all conversations the user is part of
const unsubscribeAllConversations = await realtimeService.subscribeToAllConversations();

// Subscribe to all group chats the user is part of
const unsubscribeAllGroupChats = await realtimeService.subscribeToAllGroupChats();

// Don't forget to unsubscribe when done
unsubscribeConversation();
```

### Handling Message Events

```typescript
// Handle new messages
realtimeService.on('new_message', (message) => {
  console.log('New message received:', message);
});

// Handle message delivery status
realtimeService.on('message_delivered', (message) => {
  console.log('Message delivered:', message);
});

// Handle message read status
realtimeService.on('message_read', (message) => {
  console.log('Message read:', message);
});

// Handle errors
realtimeService.onError((error) => {
  console.error('Realtime error:', error);
});
```

### Marking Messages as Read

```typescript
// Mark a message as read
await realtimeService.markMessageAsRead(messageId);
```

## React Hook Usage

For React components, use the provided hook for a simpler interface:

```typescript
import { useRealtimeMessaging } from '@/hooks/use-realtime-messaging';

function ChatComponent({ userId, conversationId }) {
  const {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    subscribeToEvent,
    unsubscribeFromEvent,
  } = useRealtimeMessaging({
    userId,
    conversationId,
  });

  // Send a message
  const handleSend = async () => {
    await sendMessage('Hello, world!');
  };

  // Mark a message as read
  const handleMarkAsRead = async (messageId) => {
    await markAsRead(messageId);
  };

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {messages.map((message) => (
            <div key={message.id}>
              <p>{message.content}</p>
              <p>From: {message.sender_id}</p>
              <p>Status: {message.read_status || 'sent'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

See `components/messaging/messaging-example.tsx` for a more complete example.

## Optimization Considerations

### Subscription Management

- Subscribe only to active conversations to minimize Realtime costs
- Unsubscribe from inactive conversations when they're no longer needed
- Consider using `subscribeToConversation` for individual chats rather than `subscribeToAllConversations` when possible

### Message Delivery Status

- Message delivery status is tracked automatically
- Messages are marked as "delivered" when they're received by the client
- Messages are marked as "read" when the user explicitly marks them as read or views them

## Security Considerations

- All message content is encrypted end-to-end using Virgil Security's E3Kit
- Supabase Realtime only transmits encrypted message content
- RLS policies ensure that users can only access messages in conversations they're part of
- Read receipts are protected by RLS policies to ensure privacy

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Virgil Security E3Kit Documentation](https://developer.virgilsecurity.com/docs/e3kit/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)