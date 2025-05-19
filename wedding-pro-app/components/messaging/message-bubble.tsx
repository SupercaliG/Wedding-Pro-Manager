'use client';

import { useState } from 'react';
import { DecryptedMessage } from '@/utils/messaging/realtime-service';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isCurrentUser: boolean;
  showTimestamp?: boolean;
  onMarkAsRead?: (messageId: string) => Promise<void>;
}

/**
 * Component for displaying a single message bubble
 */
export function MessageBubble({
  message,
  isCurrentUser,
  showTimestamp = true,
  onMarkAsRead,
}: MessageBubbleProps) {
  const [isMarking, setIsMarking] = useState(false);

  const handleMarkAsRead = async () => {
    if (!onMarkAsRead || isCurrentUser || isMarking || message.read_status === 'read') {
      return;
    }

    try {
      setIsMarking(true);
      await onMarkAsRead(message.id);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    } finally {
      setIsMarking(false);
    }
  };

  // Format timestamp
  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}
      onClick={handleMarkAsRead}
    >
      <div
        className={`max-w-[75%] p-3 rounded-lg ${
          isCurrentUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
        
        {/* Timestamp and read status */}
        {showTimestamp && (
          <div className={`text-xs mt-1 flex justify-end items-center ${
            isCurrentUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span className="opacity-75">{timestamp}</span>
            
            {/* Read receipts (only for current user's messages) */}
            {isCurrentUser && (
              <span className="ml-1">
                {message.read_status === 'read' ? (
                  <CheckCheck className="h-3 w-3 inline" />
                ) : message.read_status === 'delivered' ? (
                  <Check className="h-3 w-3 inline" />
                ) : null}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}