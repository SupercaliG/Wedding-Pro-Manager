'use client';

import { useEffect, useRef } from 'react';
import { DecryptedMessage } from '@/utils/messaging/realtime-service';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: DecryptedMessage[];
  currentUserId: string;
  onMarkAsRead?: (messageId: string) => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
}

/**
 * Component for displaying a list of messages
 */
export function MessageList({
  messages,
  currentUserId,
  onMarkAsRead,
  isLoading = false,
  error = null,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages by date
  const groupedMessages = messages.reduce<{
    [date: string]: DecryptedMessage[];
  }>((groups, message) => {
    const date = new Date(message.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Group consecutive messages from the same sender
  const groupConsecutiveMessages = (messages: DecryptedMessage[]) => {
    return messages.reduce<{
      messages: DecryptedMessage[];
      lastSenderId: string | null;
      groups: DecryptedMessage[][];
    }>(
      (acc, message) => {
        if (acc.lastSenderId === message.sender_id) {
          // Same sender, add to current group
          acc.messages.push(message);
        } else {
          // New sender, start a new group
          if (acc.messages.length > 0) {
            acc.groups.push([...acc.messages]);
          }
          acc.messages = [message];
          acc.lastSenderId = message.sender_id;
        }
        return acc;
      },
      { messages: [], lastSenderId: null, groups: [] }
    ).groups;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="animate-pulse flex flex-col space-y-2 w-full max-w-md">
          <div className="h-10 bg-gray-200 rounded w-3/4 ml-auto mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded w-2/3 ml-auto"></div>
          <div className="h-10 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold">Error loading messages</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-gray-500 text-center">
          No messages yet. Start the conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4 overflow-y-auto">
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
              {date}
            </div>
          </div>
          
          {groupConsecutiveMessages(dateMessages).map((group, groupIndex) => (
            <div key={`${date}-${groupIndex}`} className="space-y-1">
              {group.map((message, messageIndex) => {
                const isCurrentUser = message.sender_id === currentUserId;
                const isLastInGroup = messageIndex === group.length - 1;
                
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isCurrentUser={isCurrentUser}
                    showTimestamp={isLastInGroup}
                    onMarkAsRead={onMarkAsRead}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}