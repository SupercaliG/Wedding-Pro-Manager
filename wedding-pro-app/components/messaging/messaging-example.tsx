'use client';

import { useState, useEffect, useRef } from 'react';
import { useRealtimeMessaging } from '@/hooks/use-realtime-messaging';

interface MessagingExampleProps {
  userId: string;
  conversationId?: string;
  groupChatId?: string;
  recipientName?: string;
  groupName?: string;
}

/**
 * Example component demonstrating how to use the Realtime messaging hook
 * This is a reference implementation and not meant for production use
 */
export function MessagingExample({
  userId,
  conversationId,
  groupChatId,
  recipientName,
  groupName,
}: MessagingExampleProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize the Realtime messaging hook
  const {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    subscribeToEvent,
  } = useRealtimeMessaging({
    userId,
    conversationId,
    groupChatId,
  });
  
  // Scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Set up event handlers for message delivery and read status
  useEffect(() => {
    // Example of subscribing to message delivery events
    const handleMessageDelivered = (message: any) => {
      console.log('Message delivered:', message);
    };
    
    // Example of subscribing to message read events
    const handleMessageRead = (message: any) => {
      console.log('Message read:', message);
    };
    
    // Subscribe to events
    subscribeToEvent('message_delivered', handleMessageDelivered);
    subscribeToEvent('message_read', handleMessageRead);
    
    // Clean up subscriptions
    return () => {
      // Note: unsubscribeFromEvent is available but not used here
      // as the hook will clean up when the component unmounts
    };
  }, [subscribeToEvent]);
  
  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      return;
    }
    
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };
  
  // Handle marking a message as read
  const handleMarkAsRead = async (messageId: string) => {
    try {
      await markAsRead(messageId);
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };
  
  // Determine the chat title
  const chatTitle = groupChatId 
    ? groupName || 'Group Chat' 
    : recipientName || 'Direct Message';
  
  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto border rounded-lg overflow-hidden">
      {/* Chat header */}
      <div className="bg-gray-100 p-4 border-b">
        <h2 className="text-lg font-semibold">{chatTitle}</h2>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p>Loading messages...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            <p>Error: {error.message}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isCurrentUser = message.sender_id === userId;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  onClick={() => {
                    if (!isCurrentUser) {
                      handleMarkAsRead(message.id);
                    }
                  }}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p>{message.content}</p>
                    <div className="text-xs mt-1 flex justify-end">
                      <span className="opacity-75">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isCurrentUser && message.read_status && (
                        <span className="ml-2">
                          {message.read_status === 'read' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || !newMessage.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}