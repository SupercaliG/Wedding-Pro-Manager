'use client';

import { useState, useEffect } from 'react';
import { GroupChatContainer } from './group-chat-container';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/utils/supabase/client';
import { initializeEncryption } from '@/utils/encryption/encryption-utils';
import { Loader2, Users, Plus } from 'lucide-react';

interface User {
  id: string;
  name: string;
}

interface GroupChatExampleProps {
  userId: string;
  isJobThread?: boolean;
  jobId?: string;
}

/**
 * Example component for demonstrating group chat functionality
 * Includes a list of existing group chats and the ability to create new ones
 */
export function GroupChatExample({
  userId,
  isJobThread = false,
  jobId,
}: GroupChatExampleProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupChats, setGroupChats] = useState<Array<{id: string; name: string}>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const supabase = createClient();

  // Load the user's group chats
  useEffect(() => {
    const loadGroupChats = async () => {
      try {
        setLoading(true);
        
        // Get all group chats the user is part of
        const { data: participations, error: participationsError } = await supabase
          .from('group_chat_participants')
          .select('group_chat_id')
          .eq('user_id', userId);
        
        if (participationsError) throw participationsError;
        
        if (participations.length === 0) {
          setGroupChats([]);
          setLoading(false);
          return;
        }
        
        // Get details for each group chat
        const groupChatIds = participations.map(p => p.group_chat_id);
        const { data: groups, error: groupsError } = await supabase
          .from('group_chats')
          .select('group_chat_id, name')
          .in('group_chat_id', groupChatIds);
        
        if (groupsError) throw groupsError;
        
        setGroupChats(groups.map(g => ({
          id: g.group_chat_id,
          name: g.name,
        })));
        
        // Select the first group by default if there are any
        if (groups.length > 0 && !selectedGroupId) {
          setSelectedGroupId(groups[0].group_chat_id);
        }
      } catch (err) {
        console.error('Failed to load group chats:', err);
        setError('Failed to load your group chats');
      } finally {
        setLoading(false);
      }
    };
    
    loadGroupChats();
  }, [userId, supabase, selectedGroupId]);

  // Load available users for creating a new group
  useEffect(() => {
    const loadAvailableUsers = async () => {
      if (!isCreateModalOpen) return;
      
      try {
        // Get all users in the organization
        const { data: orgUsers, error: orgError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .neq('id', userId) // Exclude current user
          .order('full_name');
        
        if (orgError) throw orgError;
        
        setAvailableUsers(orgUsers.map(user => ({
          id: user.id,
          name: user.full_name || 'Unknown User',
        })));
      } catch (err) {
        console.error('Failed to load available users:', err);
        setError('Failed to load available users');
      }
    };
    
    loadAvailableUsers();
  }, [isCreateModalOpen, userId, supabase]);

  // Toggle user selection for new group
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Create a new group chat
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedUsers.length === 0) {
      setError('Please provide a group name and select at least one participant');
      return;
    }
    
    try {
      setCreatingGroup(true);
      setError(null);
      
      // Initialize encryption
      const encryption = await initializeEncryption(userId);
      
      // Create the group chat in the database
      const { data: newGroup, error: groupError } = await supabase
        .from('group_chats')
        .insert({
          name: newGroupName.trim(),
          created_by: userId,
          job_id: isJobThread ? jobId : null,
        })
        .select()
        .single();
      
      if (groupError) throw groupError;
      
      // Add the current user as a participant
      const { error: creatorParticipantError } = await supabase
        .from('group_chat_participants')
        .insert({
          group_chat_id: newGroup.group_chat_id,
          user_id: userId,
        });
      
      if (creatorParticipantError) throw creatorParticipantError;
      
      // Add the selected users as participants
      const participantInserts = selectedUsers.map(participantId => ({
        group_chat_id: newGroup.group_chat_id,
        user_id: participantId,
      }));
      
      const { error: participantsError } = await supabase
        .from('group_chat_participants')
        .insert(participantInserts);
      
      if (participantsError) throw participantsError;
      
      // Create the encryption group
      await encryption.createGroupChat(
        newGroup.group_chat_id,
        [userId, ...selectedUsers]
      );
      
      // Close the modal and select the new group
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setSelectedUsers([]);
      setSelectedGroupId(newGroup.group_chat_id);
      
      // Refresh the group list
      window.location.reload();
    } catch (err) {
      console.error('Failed to create group chat:', err);
      setError('Failed to create the group chat');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Group Chats</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Group Chat
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      ) : groupChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Group Chats Yet</h3>
          <p className="text-gray-500 mb-4">
            Create a new group chat to start messaging with multiple people at once.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Group Chat
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Group chat list */}
          <div className="bg-white rounded-lg shadow p-4 md:col-span-1">
            <h2 className="font-medium mb-3">Your Groups</h2>
            <ul className="space-y-2">
              {groupChats.map(group => (
                <li key={group.id}>
                  <button
                    className={`w-full text-left p-2 rounded-md transition ${
                      selectedGroupId === group.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    {group.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Selected group chat */}
          <div className="md:col-span-3">
            {selectedGroupId ? (
              <GroupChatContainer
                userId={userId}
                groupChatId={selectedGroupId}
                groupName={groupChats.find(g => g.id === selectedGroupId)?.name || 'Group Chat'}
                isJobThread={isJobThread}
                jobId={jobId}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  Select a group chat to start messaging
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Create Group Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open: boolean) => setIsCreateModalOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group Chat</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {/* Group Name Input */}
            <div className="mb-4">
              <label htmlFor="group-name" className="block text-sm font-medium mb-1">
                Group Name
              </label>
              <input
                id="group-name"
                type="text"
                className="w-full p-2 border rounded-md"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
            
            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Select Participants
              </label>
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {availableUsers.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm">No users available</p>
                ) : (
                  <ul className="divide-y">
                    {availableUsers.map(user => (
                      <li key={user.id} className="p-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="rounded"
                          />
                          <span>{user.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {selectedUsers.length} participants selected
              </p>
            </div>
            
            {/* Error message */}
            {error && (
              <div className="mt-4 p-2 bg-red-50 text-red-600 text-sm rounded-md">
                {error}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewGroupName('');
                setSelectedUsers([]);
                setError(null);
              }}
              disabled={creatingGroup}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={creatingGroup || !newGroupName.trim() || selectedUsers.length === 0}
            >
              {creatingGroup ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Create Group
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}