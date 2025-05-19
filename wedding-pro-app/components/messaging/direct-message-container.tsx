'use client';

import { useState, useEffect } from 'react';
import { useRealtimeMessaging } from '@/hooks/use-realtime-messaging';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import { TypingIndicator } from './typing-indicator';
import { SafetyNumberVerification } from './safety-number-verification';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';

interface DirectMessageContainerProps {
  userId: string;
  conversationId: string;
  recipientId: string;
  recipientName: string;
}

/**
 * Container component for direct messaging
 */
export function DirectMessageContainer({
  userId,
  conversationId,
  recipientId,
  recipientName,
}: DirectMessageContainerProps) {
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [isLoadingSafetyNumber, setIsLoadingSafetyNumber] = useState(true);

  // Initialize the messaging hook
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

  // Load the safety number
  useEffect(() => {
    const loadSafetyNumber = async () => {
      try {
        setIsLoadingSafetyNumber(true);
        const encryption = await initializeEncryption(userId);
        const number = await encryption.getIdentityVerificationString(recipientId);
        setSafetyNumber(number);
      } catch (error) {
        console.error('Failed to load safety number:', error);
      } finally {
        setIsLoadingSafetyNumber(false);
      }
    };

    loadSafetyNumber();
  }, [userId, recipientId]);

  // Subscribe to typing events
  useEffect(() => {
    // Custom event handlers for typing indicators
    // In a real implementation, these would be handled by the Realtime service
    const handleTypingStart = () => {
      setIsRecipientTyping(true);
    };

    const handleTypingStop = () => {
      setIsRecipientTyping(false);
    };

    // For demonstration purposes, we're simulating typing events
    // In a real implementation, these would be actual events from the Realtime service
    const typingStartInterval = setInterval(() => {
      // Randomly show typing indicator (20% chance)
      if (Math.random() < 0.2 && messages.length > 0) {
        handleTypingStart();
        
        // Stop typing after 2-5 seconds
        setTimeout(handleTypingStop, 2000 + Math.random() * 3000);
      }
    }, 10000);

    return () => {
      clearInterval(typingStartInterval);
    };
  }, [messages.length]);

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  // Handle notifying when the user is typing
  const handleTyping = () => {
    // In a real implementation, this would send a typing event to the Realtime service
    console.log('User is typing...');
  };

  // Handle notifying when the user stops typing
  const handleStopTyping = () => {
    // In a real implementation, this would send a stop typing event to the Realtime service
    console.log('User stopped typing');
  };

  // Handle verifying the safety number
  const handleVerifySafetyNumber = async (verified: boolean) => {
    try {
      // In a real implementation, this would store the verification status
      setIsVerified(verified);
      
      // For demonstration purposes, we're just logging the verification
      console.log(`Safety number verification: ${verified ? 'Verified' : 'Failed'}`);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to verify safety number:', error);
      return Promise.reject(error);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto border rounded-lg overflow-hidden bg-white shadow-md">
      {/* Chat header */}
      <div className="bg-gray-100 p-3 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">{recipientName}</h2>
        
        {/* Safety number verification */}
        {!isLoadingSafetyNumber && (
          <SafetyNumberVerification
            recipientId={recipientId}
            recipientName={recipientName}
            safetyNumber={safetyNumber}
            onVerify={handleVerifySafetyNumber}
            isVerified={isVerified}
          />
        )}
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          messages={messages}
          currentUserId={userId}
          onMarkAsRead={markAsRead}
          isLoading={loading}
          error={error}
        />
        
        {/* Typing indicator */}
        <TypingIndicator
          isTyping={isRecipientTyping}
          senderName={recipientName}
        />
      </div>
      
      {/* Message composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        disabled={loading}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
      />
    </div>
  );
}