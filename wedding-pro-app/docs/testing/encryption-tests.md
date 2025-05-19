# Automated Tests for Encryption/Decryption

This document outlines the testing strategy for the encryption and decryption functionality in the Wedding Pro messaging system.

## Target Files
- [`encryption-service.ts`](../../utils/encryption/encryption-service.ts)
- [`encryption-utils.ts`](../../utils/encryption/encryption-utils.ts)

## Test Cases

### 1. Key Generation & Management
- Generate encryption keys for new users
- Backup and restore user private keys
- Handle key rotation scenarios
- Validate key format and strength

### 2. One-to-One Encryption
- Encrypt message with recipient's public key
- Decrypt message with recipient's private key
- Handle invalid key scenarios
- Test message integrity verification

### 3. Group Chat Encryption
- Create and manage group encryption keys
- Add/remove participants (key redistribution)
- Group message encryption/decryption
- Handle participant key updates

### 4. Safety Number Verification
- Generate safety numbers for pairs of users
- Validate safety number calculation
- Test safety number comparison logic
- Handle key change scenarios

## Test Implementation (Vitest)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncryptionService } from '../../utils/encryption/encryption-service';
import { mockVirgilE3Kit } from '../mocks/virgil-e3kit-mock';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  
  beforeEach(() => {
    vi.mock('@virgilsecurity/e3kit-browser', () => mockVirgilE3Kit);
    encryptionService = new EncryptionService();
  });

  describe('One-to-One Encryption', () => {
    it('should encrypt and decrypt messages correctly', async () => {
      const message = 'Test message';
      const recipientId = 'user-123';
      
      // Setup mock identity and keys
      await encryptionService.initialize('user-456');
      
      // Test encryption
      const encrypted = await encryptionService.encryptMessage(message, recipientId);
      expect(encrypted).not.toBe(message);
      
      // Test decryption
      const decrypted = await encryptionService.decryptMessage(encrypted, recipientId);
      expect(decrypted).toBe(message);
    });
    
    it('should handle invalid recipient keys', async () => {
      await encryptionService.initialize('user-456');
      
      await expect(
        encryptionService.encryptMessage('Test message', 'non-existent-user')
      ).rejects.toThrow();
    });
  });

  describe('Group Encryption', () => {
    it('should encrypt and decrypt group messages', async () => {
      const groupId = 'group-123';
      const message = 'Group test message';
      
      await encryptionService.initialize('user-456');
      await encryptionService.createGroupChat(groupId, ['user-123', 'user-789']);
      
      const encrypted = await encryptionService.encryptGroupMessage(message, groupId);
      const decrypted = await encryptionService.decryptGroupMessage(encrypted, groupId);
      
      expect(decrypted).toBe(message);
    });
    
    it('should handle adding/removing participants', async () => {
      const groupId = 'group-123';
      await encryptionService.initialize('user-456');
      await encryptionService.createGroupChat(groupId, ['user-123']);
      
      // Add participant
      await encryptionService.addGroupParticipant(groupId, 'user-789');
      
      // Verify new participant can decrypt
      const message = 'Test after adding participant';
      const encrypted = await encryptionService.encryptGroupMessage(message, groupId);
      
      // Mock as new participant
      const newParticipantService = new EncryptionService();
      await newParticipantService.initialize('user-789');
      
      const decrypted = await newParticipantService.decryptGroupMessage(encrypted, groupId);
      expect(decrypted).toBe(message);
      
      // Remove participant
      await encryptionService.removeGroupParticipant(groupId, 'user-789');
      
      // Verify removed participant cannot decrypt new messages
      const newMessage = 'Test after removing participant';
      const newEncrypted = await encryptionService.encryptGroupMessage(newMessage, groupId);
      
      await expect(
        newParticipantService.decryptGroupMessage(newEncrypted, groupId)
      ).rejects.toThrow();
    });
  });
  
  describe('Safety Numbers', () => {
    it('should generate consistent safety numbers for the same key pairs', async () => {
      await encryptionService.initialize('user-1');
      
      const otherService = new EncryptionService();
      await otherService.initialize('user-2');
      
      const safetyNumber1 = await encryptionService.getSafetyNumber('user-2');
      const safetyNumber2 = await otherService.getSafetyNumber('user-1');
      
      expect(safetyNumber1).toBe(safetyNumber2);
    });
    
    it('should detect changed safety numbers when keys change', async () => {
      await encryptionService.initialize('user-1');
      
      const otherService = new EncryptionService();
      await otherService.initialize('user-2');
      
      const originalSafetyNumber = await encryptionService.getSafetyNumber('user-2');
      
      // Simulate key rotation
      await otherService.rotateKeys();
      
      const newSafetyNumber = await encryptionService.getSafetyNumber('user-2');
      expect(newSafetyNumber).not.toBe(originalSafetyNumber);
    });
  });
});
```

## Edge Function Testing

The Virgil JWT edge function should also be tested:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { serve } from '../get-virgil-jwt/index';

describe('get-virgil-jwt Edge Function', () => {
  it('should return 401 for unauthenticated requests', async () => {
    const mockRequest = new Request('http://localhost/functions/v1/get-virgil-jwt');
    const response = await serve(mockRequest);
    
    expect(response.status).toBe(401);
  });
  
  it('should generate a valid JWT for authenticated users', async () => {
    // Mock authenticated request
    const mockRequest = new Request('http://localhost/functions/v1/get-virgil-jwt', {
      headers: {
        authorization: 'Bearer valid-token'
      }
    });
    
    // Mock Supabase auth
    vi.mock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: 'test-user-id' } } })
        }
      })
    }));
    
    const response = await serve(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('token');
    expect(typeof data.token).toBe('string');
  });
});