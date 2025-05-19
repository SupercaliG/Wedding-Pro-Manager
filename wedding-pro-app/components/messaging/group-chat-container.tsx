'use client';

import { useState, useEffect, useRef } from 'react';
import { useRealtimeMessaging } from '@/hooks/use-realtime-messaging';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import { TypingIndicator } from './typing-indicator';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';
import { Button } from '@/components/ui/button';
import { Users, Settings } from 'lucide-react';
import { GroupSettingsModal } from './group-settings-modal';
import { createClient } from '@/utils/supabase/client';

interface GroupChatParticipant {
  id: string;
  name: string;
  isOnline?: boolean;
}

interface GroupChatContainerProps {
  userId: string;
  groupChatId: string;
  groupName: string;
  isJobThread?: boolean;
  jobId?: string;
}

/**
 * Container component for group chat messaging
 */
export function GroupChatContainer({
  userId,
  groupChatId,
  groupName,
  isJobThread = false,
  jobId,
}: GroupChatContainerProps) {
  const [isTypingMap, setIsTypingMap] = useState<Record<string, boolean>>({});
  const [participants, setParticipants] = useState<GroupChatParticipant[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const supabase = createClient();
  
  // Initialize the messaging hook with groupChatId instead of conversationId
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
    groupChatId,
  });

  // Load participants
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        // Get all participants in the group chat
        const { data: participantData, error: participantError } = await supabase
          .from('group_chat_participants')
          .select('user_id')
          .eq('group_chat_id', groupChatId);

        if (participantError) {
          throw participantError;
        }

        // Get profile information for each participant
        const participantIds = participantData.map(p => p.user_id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', participantIds);

        if (profileError) {
          throw profileError;
        }

        // Map profiles to participants
        const formattedParticipants = participantIds.map(id => {
          const profile = profileData.find(p => p.id === id);
          return {
            id,
            name: profile?.full_name || 'Unknown User',
            isOnline: false, // We could implement real presence detection in the future
          };
        });

        setParticipants(formattedParticipants);
      } catch (error) {
        console.error('Failed to load participants:', error);
      }
    };

    loadParticipants();
  }, [groupChatId, supabase]);

  // Subscribe to typing events
  useEffect(() => {
    // Custom event handlers for typing indicators
    // In a real implementation, these would be handled by the Realtime service
    const handleTypingStart = (userId: string) => {
      setIsTypingMap(prev => ({ ...prev, [userId]: true }));
    };

    const handleTypingStop = (userId: string) => {
      setIsTypingMap(prev => ({ ...prev, [userId]: false }));
    };

    // For demonstration purposes, we're simulating typing events
    // In a real implementation, these would be actual events from the Realtime service
    const typingStartInterval = setInterval(() => {
      if (participants.length > 0 && messages.length > 0) {
        // Randomly select a participant to show typing
        const randomParticipant = participants[Math.floor(Math.random() * participants.length)];
        
        // Skip if it's the current user
        if (randomParticipant.id === userId) return;
        
        // 20% chance to show typing
        if (Math.random() < 0.2) {
          handleTypingStart(randomParticipant.id);
          
          // Stop typing after 2-5 seconds
          setTimeout(() => handleTypingStop(randomParticipant.id), 2000 + Math.random() * 3000);
        }
      }
    }, 10000);

    return () => {
      clearInterval(typingStartInterval);
    };
  }, [participants, messages.length, userId]);

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  // Handle notifying when the user is typing
  const handleTyping = () => {
    // In a real implementation, this would send a typing event to the Realtime service
    console.log('User is typing in group chat...');
  };

  // Handle notifying when the user stops typing
  const handleStopTyping = () => {
    // In a real implementation, this would send a stop typing event to the Realtime service
    console.log('User stopped typing in group chat');
  };

  // Get the name of the person who is typing
  const getTypingNames = () => {
    const typingParticipants = participants.filter(p => isTypingMap[p.id] && p.id !== userId);
    
    if (typingParticipants.length === 0) {
      return null;
    } else if (typingParticipants.length === 1) {
      return typingParticipants[0].name;
    } else {
      return `${typingParticipants.length} people`;
    }
  };

  const typingName = getTypingNames();

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto border rounded-lg overflow-hidden bg-white shadow-md">
      {/* Chat header */}
      <div className="bg-gray-100 p-3 border-b flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">{groupName}</h2>
          {isJobThread && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Job Thread
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* Participants button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={() => setIsParticipantsOpen(true)}
          >
            <Users className="h-4 w-4" />
            <span className="text-xs">{participants.length}</span>
          </Button>
          
          {/* Settings button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Group Settings</span>
          </Button>
        </div>
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
          isTyping={!!typingName}
          senderName={typingName || undefined}
        />
      </div>
      
      {/* Message composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        disabled={loading}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
        placeholder="Type a message to the group..."
      />

      {/* Group settings modal */}
      <GroupSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        groupChatId={groupChatId}
        groupName={groupName}
        participants={participants}
        currentUserId={userId}
        isJobThread={isJobThread}
        jobId={jobId}
      />

      {/* Participants list modal */}
      {isParticipantsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-80 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Group Participants</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsParticipantsOpen(false)}
              >
                ✕
              </Button>
            </div>
            <ul className="space-y-2">
              {participants.map(participant => (
                <li key={participant.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span>{participant.name}</span>
                  <span className={`w-2 h-2 rounded-full ${participant.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}