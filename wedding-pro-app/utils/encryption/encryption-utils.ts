import { createClient } from '@supabase/supabase-js';
import { VirgilEncryptionService } from './encryption-service';

/**
 * Configuration for the encryption utilities
 */
interface EncryptionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  virgilAppId: string;
  virgilApiKey: string;
}

/**
 * Utility functions for encryption operations in the application
 * Provides a simplified interface for common encryption tasks
 */
export class EncryptionUtils {
  private static instance: EncryptionUtils | null = null;
  private encryptionService: VirgilEncryptionService | null = null;
  private supabase: any;
  private userId: string | null = null;
  private config: EncryptionConfig;
  private initialized = false;

  /**
   * Create a new EncryptionUtils instance
   * @param config Configuration for encryption
   */
  private constructor(config: EncryptionConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Get the singleton instance of EncryptionUtils
   * @param config Configuration for encryption (only needed on first call)
   * @returns The EncryptionUtils instance
   */
  public static getInstance(config?: EncryptionConfig): EncryptionUtils {
    if (!EncryptionUtils.instance) {
      if (!config) {
        throw new Error('Configuration is required for first initialization');
      }
      EncryptionUtils.instance = new EncryptionUtils(config);
    }
    return EncryptionUtils.instance;
  }

  /**
   * Initialize the encryption utilities for a specific user
   * @param userId The ID of the current user
   */
  public async initialize(userId: string): Promise<void> {
    if (this.initialized && this.userId === userId) {
      // Already initialized for this user
      return;
    }

    this.userId = userId;

    // Create a function to get Virgil JWT tokens
    const getVirgilToken = async (): Promise<string> => {
      try {
        // In a real implementation, you would call your backend to get a token
        // For now, we'll simulate this with a Supabase function call
        const { data, error } = await this.supabase.functions.invoke('get-virgil-jwt', {
          body: { identity: userId },
        });

        if (error) throw error;
        return data.token;
      } catch (error) {
        console.error('Failed to get Virgil JWT token:', error);
        throw error;
      }
    };

    // Initialize the encryption service
    this.encryptionService = new VirgilEncryptionService(
      userId,
      getVirgilToken,
      this.config.supabaseUrl,
      this.config.supabaseKey
    );

    await this.encryptionService.initialize();
    this.initialized = true;
  }

  /**
   * Encrypt a message for one or more recipients
   * @param message The plaintext message to encrypt
   * @param recipientIds Array of recipient user IDs
   * @returns Encrypted message string
   */
  public async encryptMessage(message: string, recipientIds: string[]): Promise<string> {
    this.checkInitialized();
    return await this.encryptionService!.encrypt(message, recipientIds);
  }

  /**
   * Decrypt a message from a sender
   * @param encryptedMessage The encrypted message
   * @param senderId The ID of the user who sent the message
   * @returns Decrypted plaintext message
   */
  public async decryptMessage(encryptedMessage: string, senderId: string): Promise<string> {
    this.checkInitialized();
    return await this.encryptionService!.decrypt(encryptedMessage, senderId);
  }

  /**
   * Encrypt a message for a group chat
   * @param groupId The group's unique identifier
   * @param message The plaintext message to encrypt
   * @returns Encrypted message string
   */
  public async encryptGroupMessage(groupId: string, message: string): Promise<string> {
    this.checkInitialized();
    return await this.encryptionService!.encryptGroupMessage(groupId, message);
  }

  /**
   * Decrypt a message from a group chat
   * @param groupId The group's unique identifier
   * @param encryptedMessage The encrypted message
   * @returns Decrypted plaintext message
   */
  public async decryptGroupMessage(groupId: string, encryptedMessage: string): Promise<string> {
    this.checkInitialized();
    return await this.encryptionService!.decryptGroupMessage(groupId, encryptedMessage);
  }

  /**
   * Create a new group chat with the specified participants
   * @param groupId Unique identifier for the group
   * @param participantIds Array of user IDs who will be in the group
   */
  public async createGroupChat(groupId: string, participantIds: string[]): Promise<void> {
    this.checkInitialized();
    await this.encryptionService!.createGroupChat(groupId, participantIds);
  }

  /**
   * Add a participant to an existing group chat
   * @param groupId The group's unique identifier
   * @param participantId The user ID to add to the group
   */
  public async addGroupParticipant(groupId: string, participantId: string): Promise<void> {
    this.checkInitialized();
    await this.encryptionService!.addGroupParticipant(groupId, participantId);
  }

  /**
   * Remove a participant from a group chat
   * @param groupId The group's unique identifier
   * @param participantId The user ID to remove from the group
   */
  public async removeGroupParticipant(groupId: string, participantId: string): Promise<void> {
    this.checkInitialized();
    await this.encryptionService!.removeGroupParticipant(groupId, participantId);
  }

  /**
   * Generate a verification string (safety number) to verify a user's identity
   * This helps prevent man-in-the-middle attacks
   * @param userId The ID of the user to verify
   * @returns A verification string that can be compared between users
   */
  public async getIdentityVerificationString(userId: string): Promise<string> {
    this.checkInitialized();
    return await this.encryptionService!.getIdentityVerificationString(userId);
  }

  /**
   * Verify a user's identity using their verification string
   * @param userId The ID of the user to verify
   * @param verificationString The verification string to compare
   * @returns True if the verification is successful
   */
  public async verifyIdentity(userId: string, verificationString: string): Promise<boolean> {
    this.checkInitialized();
    return await this.encryptionService!.verifyIdentity(userId, verificationString);
  }

  /**
   * Check if the encryption utilities have been initialized
   * @throws Error if not initialized
   */
  private checkInitialized(): void {
    if (!this.initialized || !this.encryptionService) {
      throw new Error('Encryption utilities not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create a configured instance of EncryptionUtils
 * @param userId The ID of the current user
 * @returns Initialized EncryptionUtils instance
 */
export async function initializeEncryption(userId: string): Promise<EncryptionUtils> {
  // Get configuration from environment variables
  const config: EncryptionConfig = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    virgilAppId: process.env.NEXT_PUBLIC_VIRGIL_APP_ID || '',
    virgilApiKey: process.env.VIRGIL_API_KEY || '',
  };

  // Validate configuration
  if (!config.supabaseUrl || !config.supabaseKey || !config.virgilAppId || !config.virgilApiKey) {
    throw new Error('Missing required environment variables for encryption');
  }

  // Get or create the EncryptionUtils instance
  const encryptionUtils = EncryptionUtils.getInstance(config);
  
  // Initialize for the current user
  await encryptionUtils.initialize(userId);
  
  return encryptionUtils;
}