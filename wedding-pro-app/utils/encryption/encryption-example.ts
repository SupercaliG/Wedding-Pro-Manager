/**
 * Example usage of the encryption utilities
 * This file demonstrates how to use the encryption utilities in the application
 * It is not meant to be used in production, but rather as a reference
 */

import { initializeEncryption } from './encryption-utils';
import { createClient } from '@supabase/supabase-js';

/**
 * Example function for sending an encrypted direct message
 * @param senderId The ID of the sender
 * @param recipientId The ID of the recipient
 * @param message The plaintext message to send
 */
export async function sendEncryptedDirectMessage(
  senderId: string,
  recipientId: string,
  message: string
): Promise<void> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(senderId);

    // Encrypt the message for the recipient
    const encryptedContent = await encryption.encryptMessage(message, [recipientId]);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get or create a conversation between the users
    const { data: conversation, error: conversationError } = await supabase
      .rpc('get_or_create_conversation', {
        user1_id: senderId,
        user2_id: recipientId,
      });

    if (conversationError) throw conversationError;

    // Insert the encrypted message into the database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        conversation_id: conversation.id,
        encrypted_content: encryptedContent,
        message_type: 'text',
      });

    if (messageError) throw messageError;

    console.log('Encrypted message sent successfully');
  } catch (error) {
    console.error('Failed to send encrypted message:', error);
    throw error;
  }
}

/**
 * Example function for receiving and decrypting a direct message
 * @param recipientId The ID of the recipient (current user)
 * @param messageId The ID of the message to decrypt
 * @returns The decrypted message
 */
export async function receiveEncryptedDirectMessage(
  recipientId: string,
  messageId: string
): Promise<string> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(recipientId);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the message from the database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('encrypted_content, sender_id')
      .eq('id', messageId)
      .single();

    if (messageError) throw messageError;

    // Decrypt the message
    const decryptedMessage = await encryption.decryptMessage(
      message.encrypted_content,
      message.sender_id
    );

    return decryptedMessage;
  } catch (error) {
    console.error('Failed to receive encrypted message:', error);
    throw error;
  }
}

/**
 * Example function for creating an encrypted group chat
 * @param creatorId The ID of the user creating the group
 * @param groupName The name of the group
 * @param participantIds The IDs of the participants (including the creator)
 * @returns The ID of the created group
 */
export async function createEncryptedGroupChat(
  creatorId: string,
  groupName: string,
  participantIds: string[]
): Promise<string> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(creatorId);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create the group chat in the database
    const { data: groupChat, error: groupError } = await supabase
      .from('group_chats')
      .insert({
        name: groupName,
        created_by: creatorId,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Add participants to the group chat
    const participants = participantIds.map(participantId => ({
      group_chat_id: groupChat.id,
      user_id: participantId,
    }));

    const { error: participantsError } = await supabase
      .from('group_chat_participants')
      .insert(participants);

    if (participantsError) throw participantsError;

    // Initialize the encryption group
    await encryption.createGroupChat(groupChat.id, participantIds);

    return groupChat.id;
  } catch (error) {
    console.error('Failed to create encrypted group chat:', error);
    throw error;
  }
}

/**
 * Example function for sending an encrypted group message
 * @param senderId The ID of the sender
 * @param groupId The ID of the group
 * @param message The plaintext message to send
 */
export async function sendEncryptedGroupMessage(
  senderId: string,
  groupId: string,
  message: string
): Promise<void> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(senderId);

    // Encrypt the message for the group
    const encryptedContent = await encryption.encryptGroupMessage(groupId, message);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert the encrypted message into the database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        group_chat_id: groupId,
        encrypted_content: encryptedContent,
        message_type: 'text',
      });

    if (messageError) throw messageError;

    console.log('Encrypted group message sent successfully');
  } catch (error) {
    console.error('Failed to send encrypted group message:', error);
    throw error;
  }
}

/**
 * Example function for receiving and decrypting a group message
 * @param recipientId The ID of the recipient (current user)
 * @param messageId The ID of the message to decrypt
 * @returns The decrypted message
 */
export async function receiveEncryptedGroupMessage(
  recipientId: string,
  messageId: string
): Promise<string> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(recipientId);

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the message from the database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('encrypted_content, group_chat_id')
      .eq('id', messageId)
      .single();

    if (messageError) throw messageError;

    // Decrypt the message
    const decryptedMessage = await encryption.decryptGroupMessage(
      message.group_chat_id,
      message.encrypted_content
    );

    return decryptedMessage;
  } catch (error) {
    console.error('Failed to receive encrypted group message:', error);
    throw error;
  }
}

/**
 * Example function for verifying a user's identity
 * @param currentUserId The ID of the current user
 * @param otherUserId The ID of the user to verify
 * @returns The verification string to compare
 */
export async function getIdentityVerificationString(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(currentUserId);

    // Get the verification string
    const verificationString = await encryption.getIdentityVerificationString(otherUserId);

    return verificationString;
  } catch (error) {
    console.error('Failed to get identity verification string:', error);
    throw error;
  }
}

/**
 * Example function for verifying a user's identity
 * @param currentUserId The ID of the current user
 * @param otherUserId The ID of the user to verify
 * @param verificationString The verification string to compare
 * @returns True if the verification is successful
 */
export async function verifyUserIdentity(
  currentUserId: string,
  otherUserId: string,
  verificationString: string
): Promise<boolean> {
  try {
    // Initialize encryption for the current user
    const encryption = await initializeEncryption(currentUserId);

    // Verify the identity
    const isVerified = await encryption.verifyIdentity(otherUserId, verificationString);

    return isVerified;
  } catch (error) {
    console.error('Failed to verify user identity:', error);
    throw error;
  }
}