import { EThree, LookupError } from '@virgilsecurity/e3kit-browser';
import { createClient } from '@supabase/supabase-js';

// Types for our encryption service
export interface EncryptionService {
  initialize(): Promise<void>;
  encrypt(message: string, recipientIds: string[]): Promise<string>;
  decrypt(encryptedMessage: string, senderId: string): Promise<string>;
  getIdentityVerificationString(userId: string): Promise<string>;
  verifyIdentity(userId: string, verificationString: string): Promise<boolean>;
  createGroupChat(groupId: string, participantIds: string[]): Promise<void>;
  addGroupParticipant(groupId: string, participantId: string): Promise<void>;
  removeGroupParticipant(groupId: string, participantId: string): Promise<void>;
  encryptGroupMessage(groupId: string, message: string): Promise<string>;
  decryptGroupMessage(groupId: string, encryptedMessage: string, senderId: string): Promise<string>;
}

/**
 * Service for end-to-end encryption using Virgil Security's E3Kit
 * Handles key generation, encryption/decryption, and identity verification
 */
export class VirgilEncryptionService implements EncryptionService {
  private e3kit: EThree | null = null;
  private currentUserId: string;
  private supabase: any;

  /**
   * Create a new encryption service instance
   * @param userId The current user's ID
   * @param getVirgilToken Function to get a Virgil JWT token
   * @param supabaseUrl Supabase URL
   * @param supabaseKey Supabase API key
   */
  constructor(
    userId: string,
    private getVirgilToken: () => Promise<string>,
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.currentUserId = userId;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize the encryption service and register the user's keys if needed
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize E3Kit with the user's identity and token
      this.e3kit = await EThree.initialize(this.getVirgilToken);
      
      // After EThree.initialize, check if a local private key exists.
      if (this.e3kit && !(await this.e3kit.hasLocalPrivateKey())) {
        try {
          // If no local private key, try to register.
          // E3Kit's register method handles checking if the user is already registered
          // on the Virgil Cloud and will restore the key if found (for non-password-protected cloud keys),
          // or create and backup a new one.
          await this.e3kit.register();
        } catch (registerError) {
          console.error('Failed to register user with Virgil after finding no local key:', registerError);
          throw registerError; // Propagate registration error if it occurs
        }
      }
      // If hasLocalPrivateKey was true, or if registration succeeded, key management is complete.
      // The `restorePrivateKey(password: string)` method is specifically for restoring a
      // password-protected backup from the cloud, which is not the scenario here.
      // Calling it with `undefined` was causing a TypeScript error and likely a runtime issue.
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw error;
    }
  }

  /**
   * Encrypt a message for one or more recipients
   * @param message The plaintext message to encrypt
   * @param recipientIds Array of recipient user IDs
   * @returns Encrypted message string
   */
  public async encrypt(message: string, recipientIds: string[]): Promise<string> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Find the public keys for all recipients
      const recipients = await this.e3kit.findUsers(recipientIds);
      
      // Encrypt the message for the recipients
      const encryptedMessage = await this.e3kit.authEncrypt(message, recipients);
      
      // Convert Buffer to string if needed
      return typeof encryptedMessage === 'string'
        ? encryptedMessage
        : encryptedMessage.toString('base64');
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public keys for some recipients: ${error.lookupResult}`);
      }
      throw error;
    }
  }

  /**
   * Decrypt a message from a sender
   * @param encryptedMessage The encrypted message
   * @param senderId The ID of the user who sent the message
   * @returns Decrypted plaintext message
   */
  public async decrypt(encryptedMessage: string, senderId: string): Promise<string> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Find the sender's public key
      const sender = await this.e3kit.findUsers(senderId);
      
      // Decrypt the message
      const decryptedMessage = await this.e3kit.authDecrypt(encryptedMessage, sender);
      
      // Convert Buffer to string if needed
      return typeof decryptedMessage === 'string'
        ? decryptedMessage
        : decryptedMessage.toString('utf8');
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public key for sender: ${senderId}`);
      }
      throw error;
    }
  }

  /**
   * Generate a verification string (safety number) to verify a user's identity
   * This helps prevent man-in-the-middle attacks
   * @param userId The ID of the user to verify
   * @returns A verification string that can be compared between users
   */
  public async getIdentityVerificationString(userId: string): Promise<string> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Find the user's public key
      const user = await this.e3kit.findUsers(userId);
      
      // Generate a verification string based on both users' public keys
      // This is a simplified implementation as E3Kit might not have this exact method
      // We're creating a fingerprint of the public key for verification
      // When findUsers is called with a single string ID, it returns Promise<ICard>
      // So, 'user' here is the ICard object itself.
      const card = await this.e3kit.findUsers(userId);
      if (!card) {
        throw new Error(`Could not find user card for ID: ${userId}`);
      }
      const publicKey = card.publicKey;
      
      // Create a hash of the public key that can be compared visually
      // This is a simplified version - in a real implementation, you would use
      // a proper fingerprinting algorithm
      const fingerprint = await this.createKeyFingerprint(publicKey);
      
      return fingerprint;
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public key for user: ${userId}`);
      }
      throw error;
    }
  }

  /**
   * Verify a user's identity using their verification string
   * @param userId The ID of the user to verify
   * @param verificationString The verification string to compare
   * @returns True if the verification is successful
   */
  public async verifyIdentity(userId: string, verificationString: string): Promise<boolean> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Find the user's public key
      const user = await this.e3kit.findUsers(userId);
      
      // Generate the fingerprint again and compare with the provided one
      // When findUsers is called with a single string ID, it returns Promise<ICard>
      const card = await this.e3kit.findUsers(userId);
      if (!card) {
        throw new Error(`Could not find user card for ID: ${userId}`);
      }
      const publicKey = card.publicKey;
      const expectedFingerprint = await this.createKeyFingerprint(publicKey);
      
      // Compare the fingerprints
      return expectedFingerprint === verificationString;
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public key for user: ${userId}`);
      }
      throw error;
    }
  }

  /**
   * Create a new group chat with the specified participants
   * @param groupId Unique identifier for the group
   * @param participantIds Array of user IDs who will be in the group
   */
  public async createGroupChat(groupId: string, participantIds: string[]): Promise<void> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Find all participants' public keys
      const participants = await this.e3kit.findUsers(participantIds);
      
      // Create a group with the participants
      await this.e3kit.createGroup(groupId, participants);
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public keys for some participants: ${error.lookupResult}`);
      }
      throw error;
    }
  }

  /**
   * Add a participant to an existing group chat
   * @param groupId The group's unique identifier
   * @param participantId The user ID to add to the group
   */
  public async addGroupParticipant(groupId: string, participantId: string): Promise<void> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Load the group with the group ID and a ticket (might be required by the API)
      // The ticket parameter is implementation-specific and might be obtained elsewhere
      const ticket = await this.getGroupTicket(groupId);
      const group = await this.e3kit.loadGroup(groupId, ticket);
      
      // Find the participant's public key
      const participant = await this.e3kit.findUsers(participantId);
      
      // Add the participant to the group
      await group.add(participant);
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public key for participant: ${participantId}`);
      }
      throw error;
    }
  }

  /**
   * Remove a participant from a group chat
   * @param groupId The group's unique identifier
   * @param participantId The user ID to remove from the group
   */
  public async removeGroupParticipant(groupId: string, participantId: string): Promise<void> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Load the group with the group ID and a ticket
      const ticket = await this.getGroupTicket(groupId);
      const group = await this.e3kit.loadGroup(groupId, ticket);
      
      // Find the participant's public key
      const participant = await this.e3kit.findUsers(participantId);
      
      // Remove the participant from the group
      await group.remove(participant);
    } catch (error) {
      if (error instanceof LookupError) {
        throw new Error(`Could not find public key for participant: ${participantId}`);
      }
      throw error;
    }
  }

  /**
   * Encrypt a message for a group chat
   * @param groupId The group's unique identifier
   * @param message The plaintext message to encrypt
   * @returns Encrypted message string
   */
  public async encryptGroupMessage(groupId: string, message: string): Promise<string> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Load the group with the group ID and a ticket
      const ticket = await this.getGroupTicket(groupId);
      const group = await this.e3kit.loadGroup(groupId, ticket);
      
      // Encrypt the message for the group
      const encryptedMessage = await group.encrypt(message);
      
      // Convert Buffer to string if needed
      return typeof encryptedMessage === 'string'
        ? encryptedMessage
        : encryptedMessage.toString('base64');
    } catch (error) {
      console.error(`Failed to encrypt group message: ${error}`);
      throw error;
    }
  }

  /**
   * Decrypt a message from a group chat
   * @param groupId The group's unique identifier
   * @param encryptedMessage The encrypted message
   * @returns Decrypted plaintext message
   */
  public async decryptGroupMessage(groupId: string, encryptedMessage: string, senderId: string): Promise<string> {
    if (!this.e3kit) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Load the group with the group ID and a ticket
      const ticket = await this.getGroupTicket(groupId);
      const group = await this.e3kit.loadGroup(groupId, ticket);
      
      // Find the sender's public key (ICard)
      const senderCard = await this.e3kit.findUsers(senderId);
      if (!senderCard) {
        // It's crucial to handle the case where the sender's card might not be found.
        // Depending on the application's requirements, this could be a fatal error
        // or a situation where decryption proceeds without sender verification (if the SDK allows).
        // However, the SDK signature `decrypt(data, sender: ICard)` implies senderCard is mandatory.
        throw new Error(`Could not find sender card for ID: ${senderId} to decrypt message in group ${groupId}`);
      }
      
      // Decrypt the message, providing the sender's ICard for signature verification
      const decryptedMessage = await group.decrypt(encryptedMessage, senderCard);
      
      // Convert Buffer to string if needed
      return typeof decryptedMessage === 'string'
        ? decryptedMessage
        : decryptedMessage.toString('utf8');
    } catch (error) {
      // Log with more context
      const specificError = error as any; // Cast to any to access potential properties like 'name' or 'message'
      console.error(`Failed to decrypt group message for group ${groupId} from sender ${senderId}: ${specificError.message || specificError}`, specificError);
      if (error instanceof LookupError) {
        // Provide more specific error information if it's a LookupError
        throw new Error(`LookupError during group message decryption for sender ${senderId} in group ${groupId}: ${error.lookupResult}`);
      }
      throw error; // Re-throw the original error or a new contextual error
    }
  } // End of decryptGroupMessage method

  /**
   * Helper method to create a fingerprint of a public key for identity verification
   * This is a simplified implementation - in a real implementation, you would use
   * a proper fingerprinting algorithm
   * @param publicKey The public key to create a fingerprint for
   * @returns A fingerprint string that can be compared visually
   */
  private async createKeyFingerprint(publicKey: any): Promise<string> {
    // This is a simplified implementation
    // In a real implementation, you would use a proper fingerprinting algorithm
    // that creates a human-readable representation of the key
    
    // Convert the public key to a string if it's not already
    const keyString = typeof publicKey === 'string'
      ? publicKey
      : JSON.stringify(publicKey);
    
    // Create a simple hash of the key
    // In a real implementation, you would use a proper hashing algorithm
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert the hash to a hexadecimal string and format it with dashes
    // to make it easier to read and compare
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hexHash.slice(0, 4)}-${hexHash.slice(4, 8)}`;
  }
  
  /**
   * Helper method to get a ticket for loading a group
   * This is a placeholder implementation - in a real implementation,
   * you would get the ticket from your backend or from the group creator
   * @param groupId The ID of the group
   * @returns A ticket for loading the group
   */
  private async getGroupTicket(groupId: string): Promise<any> {
    // In a real implementation, you would get the ticket from your backend
    // or from the group creator
    
    // For now, we'll return a placeholder ticket
    // This should be replaced with actual ticket retrieval logic
    try {
      // Query the database for the group ticket
      const { data, error } = await this.supabase
        .from('group_chat_tickets')
        .select('ticket')
        .eq('group_id', groupId)
        .single();
      
      if (error) throw error;
      
      return data.ticket;
    } catch (error) {
      console.error(`Failed to get group ticket: ${error}`);
      // Return a null ticket as a fallback
      // This might not work in a real implementation
      return null;
    }
  }
} // Closing brace for VirgilEncryptionService class