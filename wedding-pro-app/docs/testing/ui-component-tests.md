# UI Component Tests

This document outlines the testing strategy for the UI components of the encrypted messaging system in the Wedding Pro application.

## Target Components
- Message Composer
- Message List
- Message Bubble
- Typing Indicator
- Safety Number Verification
- Direct Message Container
- Group Chat Container
- Group Settings Modal

## Test Cases

### 1. Rendering Tests
- Component mounting and unmounting
- Prop validation
- State management
- Error boundary behavior

### 2. User Interaction Tests
- Message composition and sending
- File attachment handling
- Emoji picker functionality
- Group member management

### 3. Integration Tests
- Component interaction with encryption service
- Real-time updates reflection in UI
- Error handling and display
- Loading states and transitions

## Test Implementation (Vitest + React Testing Library)

### Message Composer Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MessageComposer from '../../components/messaging/message-composer';

describe('MessageComposer', () => {
  const mockSendMessage = vi.fn();
  const mockSendTypingIndicator = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should render input field and send button', () => {
    render(
      <MessageComposer 
        onSendMessage={mockSendMessage}
        onTypingIndicator={mockSendTypingIndicator}
      />
    );
    
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
  
  it('should call onSendMessage when send button is clicked', async () => {
    render(
      <MessageComposer 
        onSendMessage={mockSendMessage}
        onTypingIndicator={mockSendTypingIndicator}
      />
    );
    
    const input = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    expect(input).toHaveValue(''); // Input should be cleared
  });
  
  it('should send typing indicators when user types', async () => {
    render(
      <MessageComposer 
        onSendMessage={mockSendMessage}
        onTypingIndicator={mockSendTypingIndicator}
      />
    );
    
    const input = screen.getByPlaceholderText(/type a message/i);
    
    // Start typing
    fireEvent.change(input, { target: { value: 'T' } });
    
    expect(mockSendTypingIndicator).toHaveBeenCalledWith(true);
    
    // Clear debounce timers
    vi.advanceTimersByTime(1000);
    
    // Stop typing
    vi.clearAllMocks();
    await waitFor(() => {
      expect(mockSendTypingIndicator).toHaveBeenCalledWith(false);
    });
  });
  
  it('should handle file attachments', async () => {
    const mockHandleAttachment = vi.fn();
    
    render(
      <MessageComposer 
        onSendMessage={mockSendMessage}
        onTypingIndicator={mockSendTypingIndicator}
        onAttachment={mockHandleAttachment}
      />
    );
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    
    fireEvent.change(fileInput);
    
    expect(mockHandleAttachment).toHaveBeenCalledWith(file);
  });
});
```

### Message List Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MessageList from '../../components/messaging/message-list';

describe('MessageList', () => {
  const mockMessages = [
    { id: '1', content: 'Hello', sender_id: 'user1', created_at: '2025-05-17T10:00:00Z' },
    { id: '2', content: 'Hi there', sender_id: 'user2', created_at: '2025-05-17T10:01:00Z' },
    { id: '3', content: 'How are you?', sender_id: 'user1', created_at: '2025-05-17T10:02:00Z' }
  ];
  
  it('should render messages in chronological order', () => {
    render(
      <MessageList 
        messages={mockMessages}
        currentUserId="user1"
      />
    );
    
    const messageElements = screen.getAllByRole('listitem');
    expect(messageElements).toHaveLength(3);
    
    // Check message content order
    expect(messageElements[0]).toHaveTextContent('Hello');
    expect(messageElements[1]).toHaveTextContent('Hi there');
    expect(messageElements[2]).toHaveTextContent('How are you?');
  });
  
  it('should distinguish between sent and received messages', () => {
    render(
      <MessageList 
        messages={mockMessages}
        currentUserId="user1"
      />
    );
    
    const sentMessages = screen.getAllByTestId('sent-message');
    const receivedMessages = screen.getAllByTestId('received-message');
    
    expect(sentMessages).toHaveLength(2); // user1's messages
    expect(receivedMessages).toHaveLength(1); // user2's message
  });
  
  it('should scroll to bottom when new messages arrive', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    
    const { rerender } = render(
      <MessageList 
        messages={mockMessages}
        currentUserId="user1"
      />
    );
    
    // Add a new message
    const updatedMessages = [
      ...mockMessages,
      { id: '4', content: 'New message', sender_id: 'user2', created_at: '2025-05-17T10:03:00Z' }
    ];
    
    rerender(
      <MessageList 
        messages={updatedMessages}
        currentUserId="user1"
      />
    );
    
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
  
  it('should handle empty message list', () => {
    render(
      <MessageList 
        messages={[]}
        currentUserId="user1"
      />
    );
    
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });
});
```

### Integration Tests for Direct Message Container

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import DirectMessageContainer from '../../components/messaging/direct-message-container';

describe('DirectMessageContainer', () => {
  beforeEach(() => {
    vi.mock('../../hooks/use-realtime-messaging', () => ({
      useRealtimeMessaging: () => ({
        messages: [
          { id: '1', content: 'Hello', sender_id: 'user2', created_at: '2025-05-17T10:00:00Z' }
        ],
        sendMessage: vi.fn(),
        sendTypingIndicator: vi.fn(),
        isTyping: false,
        isSubscribed: true
      })
    }));
    
    vi.mock('../../utils/encryption/encryption-service', () => ({
      EncryptionService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        getSafetyNumber: vi.fn().mockResolvedValue('1234 5678 9012 3456')
      }))
    }));
  });
  
  it('should render the conversation UI with messages', async () => {
    render(
      <DirectMessageContainer 
        conversationId="conv-123"
        recipientId="user2"
        currentUserId="user1"
      />
    );
    
    // Wait for async operations
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
    
    // Check for message composer
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
  });
  
  it('should allow safety number verification', async () => {
    render(
      <DirectMessageContainer 
        conversationId="conv-123"
        recipientId="user2"
        currentUserId="user1"
      />
    );
    
    // Open safety number dialog
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    
    // Wait for safety number to be fetched
    await waitFor(() => {
      expect(screen.getByText(/1234 5678 9012 3456/)).toBeInTheDocument();
    });
    
    // Verify and close
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    
    // Dialog should be closed
    expect(screen.queryByText(/1234 5678 9012 3456/)).not.toBeInTheDocument();
  });
  
  it('should show typing indicator when recipient is typing', async () => {
    vi.mock('../../hooks/use-realtime-messaging', () => ({
      useRealtimeMessaging: () => ({
        messages: [],
        sendMessage: vi.fn(),
        sendTypingIndicator: vi.fn(),
        isTyping: true,
        isSubscribed: true
      })
    }));
    
    render(
      <DirectMessageContainer 
        conversationId="conv-123"
        recipientId="user2"
        currentUserId="user1"
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    });
  });
});
```

## End-to-End Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Messaging UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to messaging page
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
  });
  
  test('should send and receive direct messages', async ({ page, context }) => {
    // Open conversation with a specific user
    await page.click('text=John Doe');
    
    // Type and send a message
    await page.fill('textarea[placeholder="Type a message..."]', 'Hello from Playwright test');
    await page.click('button[aria-label="Send message"]');
    
    // Verify message appears in the conversation
    await expect(page.locator('.message-bubble').last()).toContainText('Hello from Playwright test');
    
    // Open a second browser context to simulate the recipient
    const secondBrowser = await context.newPage();
    await secondBrowser.goto('/login');
    await secondBrowser.fill('input[name="email"]', 'john@example.com');
    await secondBrowser.fill('input[name="password"]', 'password123');
    await secondBrowser.click('button[type="submit"]');
    await secondBrowser.waitForURL('/dashboard');
    await secondBrowser.click('a[href="/messages"]');
    
    // Open the same conversation
    await secondBrowser.click('text=Test User');
    
    // Verify the message was received
    await expect(secondBrowser.locator('.message-bubble').last()).toContainText('Hello from Playwright test');
    
    // Send a reply
    await secondBrowser.fill('textarea[placeholder="Type a message..."]', 'Reply from recipient');
    await secondBrowser.click('button[aria-label="Send message"]');
    
    // Verify the reply appears in the original browser
    await expect(page.locator('.message-bubble').last()).toContainText('Reply from recipient');
  });
  
  test('should create and use group chats', async ({ page }) => {
    // Create a new group chat
    await page.click('button[aria-label="New group chat"]');
    await page.fill('input[placeholder="Group name"]', 'Test Group Chat');
    
    // Add members
    await page.click('button[aria-label="Add members"]');
    await page.check('input[value="user2"]');
    await page.check('input[value="user3"]');
    await page.click('button[aria-label="Confirm members"]');
    
    // Create the group
    await page.click('button[aria-label="Create group"]');
    
    // Verify group was created and is selected
    await expect(page.locator('.conversation-title')).toContainText('Test Group Chat');
    
    // Send a message to the group
    await page.fill('textarea[placeholder="Type a message..."]', 'Hello group!');
    await page.click('button[aria-label="Send message"]');
    
    // Verify message appears
    await expect(page.locator('.message-bubble').last()).toContainText('Hello group!');
    
    // Open group settings
    await page.click('button[aria-label="Group settings"]');
    
    // Add another member
    await page.click('button[aria-label="Add members"]');
    await page.check('input[value="user4"]');
    await page.click('button[aria-label="Confirm members"]');
    
    // Verify member was added
    await expect(page.locator('.group-member-list')).toContainText('user4');
  });
  
  test('should verify safety numbers', async ({ page }) => {
    // Open conversation with a specific user
    await page.click('text=John Doe');
    
    // Open safety number verification dialog
    await page.click('button[aria-label="Verify security"]');
    
    // Check that safety number is displayed
    await expect(page.locator('.safety-number')).toBeVisible();
    
    // Verify the number
    await page.click('button[aria-label="Confirm verification"]');
    
    // Verify that the UI shows the conversation is verified
    await expect(page.locator('.verified-indicator')).toBeVisible();
  });
});
```

These tests cover the core functionality of the messaging UI components, ensuring they render correctly, handle user interactions properly, and integrate with the underlying encryption and real-time services.