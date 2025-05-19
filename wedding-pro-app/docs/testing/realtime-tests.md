# Real-time Message Delivery & Handling Tests

This document outlines the testing strategy for real-time message delivery and handling in the Wedding Pro messaging system.

## Target Files
- [`realtime-service.ts`](../../utils/messaging/realtime-service.ts)
- [`use-realtime-messaging.ts`](../../hooks/use-realtime-messaging.ts)

## Test Cases

### 1. Message Delivery
- Send and receive messages through Realtime channel
- Verify message ordering and delivery confirmation
- Test offline message handling
- Validate message persistence in database

### 2. Event Handling
- New message notifications
- Read receipt updates
- Typing indicator events
- Participant status changes

### 3. Performance Testing
- Message delivery latency (target: < 500ms)
- Concurrent user load testing
- Connection recovery after disconnection
- Bandwidth utilization

## Test Implementation

### Realtime Service Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtimeService } from '../../utils/messaging/realtime-service';
import { mockSupabaseClient } from '../mocks/supabase-client-mock';

describe('RealtimeService', () => {
  let realtimeService: RealtimeService;
  
  beforeEach(() => {
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => mockSupabaseClient
    }));
    realtimeService = new RealtimeService();
  });

  describe('Message Delivery', () => {
    it('should deliver messages in order', async () => {
      const conversationId = 'conv-123';
      const messages = ['Message 1', 'Message 2', 'Message 3'];
      const deliveredMessages: string[] = [];
      
      // Setup subscription
      await realtimeService.subscribeToConversation(
        conversationId,
        (message) => deliveredMessages.push(message.content)
      );
      
      // Send messages
      for (const message of messages) {
        await realtimeService.sendMessage(conversationId, message);
      }
      
      // Wait for delivery
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert order
      expect(deliveredMessages).toEqual(messages);
    });
    
    it('should handle offline message queuing', async () => {
      const conversationId = 'conv-123';
      
      // Simulate offline state
      mockSupabaseClient.setConnectionStatus('OFFLINE');
      
      // Queue messages while offline
      await realtimeService.sendMessage(conversationId, 'Offline message 1');
      await realtimeService.sendMessage(conversationId, 'Offline message 2');
      
      // Verify messages are queued
      expect(realtimeService.getQueuedMessageCount()).toBe(2);
      
      // Simulate coming back online
      mockSupabaseClient.setConnectionStatus('ONLINE');
      
      // Verify queued messages are sent
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(realtimeService.getQueuedMessageCount()).toBe(0);
      
      // Verify messages were sent to the database
      const sentMessages = await mockSupabaseClient.from('messages').select('*');
      expect(sentMessages.data.length).toBe(2);
    });
  });

  describe('Event Handling', () => {
    it('should handle typing indicators', async () => {
      const conversationId = 'conv-123';
      const typingEvents: any[] = [];
      
      await realtimeService.subscribeToTypingIndicators(
        conversationId,
        (event) => typingEvents.push(event)
      );
      
      // Send typing indicator
      await realtimeService.sendTypingIndicator(conversationId, true);
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(typingEvents.length).toBe(1);
      expect(typingEvents[0].isTyping).toBe(true);
      
      // Send stopped typing
      await realtimeService.sendTypingIndicator(conversationId, false);
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(typingEvents.length).toBe(2);
      expect(typingEvents[1].isTyping).toBe(false);
    });
    
    it('should handle read receipts', async () => {
      const conversationId = 'conv-123';
      const messageId = 'msg-123';
      const readEvents: any[] = [];
      
      await realtimeService.subscribeToReadReceipts(
        conversationId,
        (event) => readEvents.push(event)
      );
      
      // Send read receipt
      await realtimeService.markMessageAsRead(conversationId, messageId);
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(readEvents.length).toBe(1);
      expect(readEvents[0].messageId).toBe(messageId);
    });
  });

  describe('Performance', () => {
    it('should deliver messages within latency target', async () => {
      const conversationId = 'conv-123';
      let deliveryTime: number | null = null;
      
      await realtimeService.subscribeToConversation(
        conversationId,
        () => {
          deliveryTime = Date.now();
        }
      );
      
      const sendTime = Date.now();
      await realtimeService.sendMessage(conversationId, 'Latency test message');
      
      // Wait for delivery
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(deliveryTime).not.toBeNull();
      const latency = (deliveryTime as number) - sendTime;
      expect(latency).toBeLessThan(500); // Target: < 500ms
    });
  });
});
```

### React Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useRealtimeMessaging } from '../../hooks/use-realtime-messaging';
import { vi } from 'vitest';

describe('useRealtimeMessaging', () => {
  beforeEach(() => {
    vi.mock('../../utils/messaging/realtime-service');
    vi.mock('../../utils/encryption/encryption-service');
  });
  
  it('should subscribe to conversation on mount', async () => {
    const conversationId = 'conv-123';
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useRealtimeMessaging(conversationId)
    );
    
    await waitForNextUpdate();
    
    expect(result.current.isSubscribed).toBe(true);
  });
  
  it('should decrypt incoming messages', async () => {
    const conversationId = 'conv-123';
    const encryptedMessage = 'encrypted-content';
    const decryptedMessage = 'Hello world';
    
    // Mock decryption
    const mockDecrypt = vi.fn().mockResolvedValue(decryptedMessage);
    vi.mocked(EncryptionService.prototype.decryptMessage).mockImplementation(mockDecrypt);
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useRealtimeMessaging(conversationId)
    );
    
    await waitForNextUpdate();
    
    // Simulate incoming message
    act(() => {
      // Trigger the subscription callback with an encrypted message
      const mockCallback = vi.mocked(RealtimeService.prototype.subscribeToConversation).mock.calls[0][1];
      mockCallback({
        id: 'msg-123',
        sender_id: 'user-456',
        content: encryptedMessage,
        created_at: new Date().toISOString()
      });
    });
    
    await waitForNextUpdate();
    
    // Verify message was decrypted and added to state
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedMessage, expect.any(String));
    expect(result.current.messages[0].content).toBe(decryptedMessage);
  });
  
  it('should encrypt outgoing messages', async () => {
    const conversationId = 'conv-123';
    const message = 'Hello world';
    const encryptedMessage = 'encrypted-content';
    
    // Mock encryption
    const mockEncrypt = vi.fn().mockResolvedValue(encryptedMessage);
    vi.mocked(EncryptionService.prototype.encryptMessage).mockImplementation(mockEncrypt);
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useRealtimeMessaging(conversationId)
    );
    
    await waitForNextUpdate();
    
    // Send a message
    act(() => {
      result.current.sendMessage(message);
    });
    
    await waitForNextUpdate();
    
    // Verify message was encrypted and sent
    expect(mockEncrypt).toHaveBeenCalledWith(message, expect.any(String));
    expect(vi.mocked(RealtimeService.prototype.sendMessage))
      .toHaveBeenCalledWith(conversationId, encryptedMessage);
  });
});
```

## Load Testing

For load testing, we'll use a custom script to simulate multiple concurrent users:

```typescript
// load-test.ts
import { RealtimeService } from '../../utils/messaging/realtime-service';
import { EncryptionService } from '../../utils/encryption/encryption-service';

async function runLoadTest() {
  const NUM_USERS = 50;
  const MESSAGES_PER_USER = 20;
  const users: { realtime: RealtimeService; encryption: EncryptionService }[] = [];
  
  console.log('Setting up test users...');
  
  // Setup users
  for (let i = 0; i < NUM_USERS; i++) {
    const realtime = new RealtimeService();
    const encryption = new EncryptionService();
    await encryption.initialize(`user-${i}`);
    users.push({ realtime, encryption });
  }
  
  console.log('Starting load test...');
  const startTime = Date.now();
  
  // Create conversation pairs
  const pairs = [];
  for (let i = 0; i < NUM_USERS; i += 2) {
    if (i + 1 < NUM_USERS) {
      pairs.push([i, i + 1]);
    }
  }
  
  // Send messages concurrently
  await Promise.all(pairs.map(async ([sender, recipient]) => {
    const conversationId = `conv-${sender}-${recipient}`;
    
    // Subscribe to messages
    await users[recipient].realtime.subscribeToConversation(
      conversationId,
      async (message) => {
        // Decrypt message
        const decrypted = await users[recipient].encryption.decryptMessage(
          message.content,
          `user-${sender}`
        );
        console.log(`User ${recipient} received: ${decrypted}`);
      }
    );
    
    // Send messages
    for (let i = 0; i < MESSAGES_PER_USER; i++) {
      const message = `Message ${i} from User ${sender}`;
      const encrypted = await users[sender].encryption.encryptMessage(
        message,
        `user-${recipient}`
      );
      await users[sender].realtime.sendMessage(conversationId, encrypted);
    }
  }));
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const totalMessages = pairs.length * MESSAGES_PER_USER;
  
  console.log(`Load test completed in ${duration}ms`);
  console.log(`Sent ${totalMessages} messages`);
  console.log(`Average throughput: ${totalMessages / (duration / 1000)} messages/second`);
}

runLoadTest().catch(console.error);
```

This load test can be run with different parameters to measure system performance under various conditions.