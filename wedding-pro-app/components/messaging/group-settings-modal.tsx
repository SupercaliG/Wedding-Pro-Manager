'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';
import { Loader2, Plus, Trash, UserPlus, UserMinus } from 'lucide-react';

interface GroupParticipant {
  id: string;
  name: string;
  isOnline?: boolean;
}

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupChatId: string;
  groupName: string;
  participants: GroupParticipant[];
  currentUserId: string;
  isJobThread?: boolean;
  jobId?: string;
}

/**
 * Modal for managing group chat settings, including adding/removing members
 */
export function GroupSettingsModal({
  isOpen,
  onClose,
  groupChatId,
  groupName,
  participants,
  currentUserId,
  isJobThread = false,
  jobId,
}: GroupSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<GroupParticipant[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isCreator, setIsCreator] = useState(false);
  const supabase = createClient();

  // Check if current user is the creator of the group
  useEffect(() => {
    const checkCreator = async () => {
      try {
        const { data, error } = await supabase
          .from('group_chats')
          .select('created_by')
          .eq('group_chat_id', groupChatId)
          .single();

        if (error) throw error;
        
        setIsCreator(data.created_by === currentUserId);
      } catch (err) {
        console.error('Failed to check creator status:', err);
      }
    };

    if (isOpen) {
      checkCreator();
    }
  }, [isOpen, groupChatId, currentUserId, supabase]);

  // Load available users who are not already in the group
  useEffect(() => {
    const loadAvailableUsers = async () => {
      try {
        setLoading(true);
        
        // Get all users in the organization
        const { data: orgUsers, error: orgError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name');
        
        if (orgError) throw orgError;
        
        // Filter out users who are already participants
        const participantIds = participants.map(p => p.id);
        const filteredUsers = orgUsers
          .filter(user => !participantIds.includes(user.id))
          .map(user => ({
            id: user.id,
            name: user.full_name || 'Unknown User',
          }));
        
        setAvailableUsers(filteredUsers);
        if (filteredUsers.length > 0) {
          setSelectedUserId(filteredUsers[0].id);
        }
      } catch (err) {
        console.error('Failed to load available users:', err);
        setError('Failed to load available users');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen, participants, supabase]);

  // Add a participant to the group
  const handleAddParticipant = async () => {
    if (!selectedUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Initialize encryption
      const encryption = await initializeEncryption(currentUserId);
      
      // Add the user to the group chat in the database
      const { error: insertError } = await supabase
        .from('group_chat_participants')
        .insert({
          group_chat_id: groupChatId,
          user_id: selectedUserId,
        });
      
      if (insertError) throw insertError;
      
      // Add the user to the encryption group
      await encryption.addGroupParticipant(groupChatId, selectedUserId);
      
      // Refresh the page to update the participants list
      window.location.reload();
    } catch (err) {
      console.error('Failed to add participant:', err);
      setError('Failed to add participant to the group');
    } finally {
      setLoading(false);
    }
  };

  // Remove a participant from the group
  const handleRemoveParticipant = async (participantId: string) => {
    // Don't allow removing yourself
    if (participantId === currentUserId) {
      setError("You cannot remove yourself from the group");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Initialize encryption
      const encryption = await initializeEncryption(currentUserId);
      
      // Remove the user from the group chat in the database
      const { error: deleteError } = await supabase
        .from('group_chat_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .eq('user_id', participantId);
      
      if (deleteError) throw deleteError;
      
      // Remove the user from the encryption group
      await encryption.removeGroupParticipant(groupChatId, participantId);
      
      // Refresh the page to update the participants list
      window.location.reload();
    } catch (err) {
      console.error('Failed to remove participant:', err);
      setError('Failed to remove participant from the group');
    } finally {
      setLoading(false);
    }
  };

  // Leave the group
  const handleLeaveGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Remove yourself from the group chat in the database
      const { error: deleteError } = await supabase
        .from('group_chat_participants')
        .delete()
        .eq('group_chat_id', groupChatId)
        .eq('user_id', currentUserId);
      
      if (deleteError) throw deleteError;
      
      // Close the modal and redirect to a different page
      onClose();
      window.location.href = '/dashboard'; // Redirect to dashboard or another appropriate page
    } catch (err) {
      console.error('Failed to leave group:', err);
      setError('Failed to leave the group');
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {/* Group Info */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">Group Information</h3>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="font-medium">{groupName}</p>
              {isJobThread && jobId && (
                <p className="text-sm text-gray-500">
                  Linked to Job ID: {jobId}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {participants.length} participants
              </p>
            </div>
          </div>
          
          {/* Add Participant Section */}
          {isCreator && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Add Participant</h3>
              <div className="flex gap-2">
                <select 
                  className="flex-1 p-2 border rounded-md"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={loading || availableUsers.length === 0}
                >
                  {availableUsers.length === 0 ? (
                    <option value="">No available users</option>
                  ) : (
                    availableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  onClick={handleAddParticipant}
                  disabled={loading || !selectedUserId || availableUsers.length === 0}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  <span className="ml-2">Add</span>
                </Button>
              </div>
            </div>
          )}
          
          {/* Participants List */}
          <div>
            <h3 className="text-sm font-medium mb-2">Participants</h3>
            <ul className="border rounded-md divide-y overflow-hidden">
              {participants.map(participant => (
                <li key={participant.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${participant.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span>{participant.name}</span>
                    {participant.id === currentUserId && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  
                  {/* Remove button (only shown to creator and not for themselves) */}
                  {isCreator && participant.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveParticipant(participant.id)}
                      disabled={loading}
                    >
                      <UserMinus className="h-4 w-4 text-red-500" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}
          
          {/* Leave Group Button */}
          <div className="mt-6 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleLeaveGroup}
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Leave Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}