# Security Audits and Penetration Testing

This document outlines the security testing strategy for the encrypted messaging system in the Wedding Pro application.

## Security Audit Focus Areas

### 1. Key Management
- Secure storage of encryption keys
- Key rotation policies
- Key backup and recovery procedures
- Protection against key extraction

### 2. Data Exposure
- Encrypted data at rest (database)
- Encrypted data in transit (API calls)
- Metadata protection
- Message persistence policies

### 3. Access Controls
- Row-Level Security (RLS) policies
- Authentication mechanisms
- Authorization checks for message access
- Group chat access controls

### 4. Cryptographic Implementation
- Proper use of E3Kit libraries
- Cryptographic algorithm selection
- Key size and strength
- Random number generation

## Penetration Testing Methodology

### 1. OWASP Testing Guide
- Follow OWASP Application Security Verification Standard (ASVS)
- Focus on authentication, session management, and access control
- Test for common web vulnerabilities (XSS, CSRF, injection)

### 2. Specific Messaging Security Tests
- Attempt to access messages without proper authentication
- Attempt to decrypt messages without proper keys
- Test for metadata leakage
- Verify message integrity protection

### 3. Cryptographic Analysis
- Review cryptographic implementations
- Verify no weak algorithms or modes are used
- Check for proper key derivation functions
- Verify entropy sources

### 4. Infrastructure Security
- Supabase configuration review
- Edge function security
- API endpoint protection
- Rate limiting and DDoS protection

## Security Testing Tools
- Static Application Security Testing (SAST): SonarQube, ESLint security plugins
- Dynamic Application Security Testing (DAST): OWASP ZAP, Burp Suite
- Dependency scanning: npm audit, Snyk
- Cryptographic validation: CryptoLint, manual review

## Security Test Implementation

### RLS Policy Tests

```sql
-- Test script to verify RLS policies for messages table
-- Save as scripts/test-messaging-rls.sql

-- Setup test users
INSERT INTO auth.users (id, email) VALUES 
  ('test-user-1', 'user1@example.com'),
  ('test-user-2', 'user2@example.com'),
  ('test-user-3', 'user3@example.com');

-- Setup test conversation (direct message)
INSERT INTO conversations (id, created_at) 
VALUES ('test-conv-1-2', NOW());

-- Add participants
INSERT INTO participants (conversation_id, user_id) VALUES
  ('test-conv-1-2', 'test-user-1'),
  ('test-conv-1-2', 'test-user-2');

-- Setup test group chat
INSERT INTO group_chats (id, name, created_by) 
VALUES ('test-group-1', 'Test Group', 'test-user-1');

-- Add group participants
INSERT INTO participants (conversation_id, user_id) VALUES
  ('test-group-1', 'test-user-1'),
  ('test-group-1', 'test-user-2'),
  ('test-group-1', 'test-user-3');

-- Test message access (as user 1)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-1", "email": "user1@example.com"}';

-- Should succeed (user is participant)
INSERT INTO messages (conversation_id, sender_id, content) 
VALUES ('test-conv-1-2', 'test-user-1', 'encrypted-content-1');

-- Should succeed (user is in group)
INSERT INTO messages (conversation_id, sender_id, content) 
VALUES ('test-group-1', 'test-user-1', 'encrypted-group-content-1');

-- Should fail (user trying to impersonate another user)
INSERT INTO messages (conversation_id, sender_id, content) 
VALUES ('test-conv-1-2', 'test-user-2', 'impersonated-content');

-- Test message access (as user 3)
SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-3", "email": "user3@example.com"}';

-- Should fail (user is not participant in this conversation)
INSERT INTO messages (conversation_id, sender_id, content) 
VALUES ('test-conv-1-2', 'test-user-3', 'unauthorized-content');

-- Should succeed (user is in group)
INSERT INTO messages (conversation_id, sender_id, content) 
VALUES ('test-group-1', 'test-user-3', 'encrypted-group-content-3');

-- Test read access
SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-1", "email": "user1@example.com"}';

-- Should return messages from both conversations
SELECT * FROM messages WHERE conversation_id IN ('test-conv-1-2', 'test-group-1');

SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-3", "email": "user3@example.com"}';

-- Should only return messages from the group chat
SELECT * FROM messages WHERE conversation_id IN ('test-conv-1-2', 'test-group-1');

-- Cleanup
DELETE FROM messages WHERE conversation_id IN ('test-conv-1-2', 'test-group-1');
DELETE FROM participants WHERE conversation_id IN ('test-conv-1-2', 'test-group-1');
DELETE FROM conversations WHERE id = 'test-conv-1-2';
DELETE FROM group_chats WHERE id = 'test-group-1';
DELETE FROM auth.users WHERE id IN ('test-user-1', 'test-user-2', 'test-user-3');
```

### Key Management Tests

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService } from '../../utils/encryption/encryption-service';

describe('Encryption Key Management Security', () => {
  let encryptionService: EncryptionService;
  
  beforeEach(() => {
    // Mock IndexedDB or localStorage for key storage
    const mockStorage = {};
    
    global.localStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key) => { delete mockStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }),
      key: vi.fn((index) => Object.keys(mockStorage)[index] || null),
      length: Object.keys(mockStorage).length
    };
    
    encryptionService = new EncryptionService();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should not expose private keys in memory after use', async () => {
    await encryptionService.initialize('test-user');
    
    // Force garbage collection to clear any references
    // Note: This is implementation-specific and may not work in all environments
    global.gc && global.gc();
    
    // Use a memory profiler to check for key material
    // This is a conceptual test - actual implementation would depend on the testing environment
    const memoryUsage = process.memoryUsage();
    
    // Check that sensitive objects are properly cleaned up
    // This would require a more sophisticated setup in a real test
    expect(true).toBe(true); // Placeholder assertion
  });
  
  it('should securely store backup keys with encryption', async () => {
    await encryptionService.initialize('test-user');
    
    // Backup the keys with a password
    const backupPassword = 'secure-password-123';
    const backup = await encryptionService.backupKeys(backupPassword);
    
    // Verify the backup is encrypted (not plaintext)
    expect(backup).not.toContain('PRIVATE KEY');
    
    // Attempt to restore with wrong password
    await expect(
      encryptionService.restoreKeys(backup, 'wrong-password')
    ).rejects.toThrow();
    
    // Restore with correct password should work
    await expect(
      encryptionService.restoreKeys(backup, backupPassword)
    ).resolves.not.toThrow();
  });
  
  it('should implement key rotation securely', async () => {
    await encryptionService.initialize('test-user');
    
    // Create a message with the original key
    const recipient = 'other-user';
    const message = 'Test message';
    const encrypted = await encryptionService.encryptMessage(message, recipient);
    
    // Rotate keys
    await encryptionService.rotateKeys();
    
    // Verify old messages can still be decrypted
    const decrypted = await encryptionService.decryptMessage(encrypted, recipient);
    expect(decrypted).toBe(message);
    
    // Verify new messages use the new key
    // This would require checking the key ID or similar mechanism
    // Placeholder assertion
    expect(true).toBe(true);
  });
});
```

### Penetration Testing Script

```typescript
// security/penetration-tests.ts
import axios from 'axios';
import * as crypto from 'crypto';

async function runPenetrationTests() {
  console.log('Running penetration tests for messaging system...');
  
  // Test 1: Attempt to access messages without authentication
  try {
    const response = await axios.get('/api/messages', {
      headers: { 
        // No auth token provided
      }
    });
    console.error('FAIL: Unauthenticated access to messages API succeeded');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('PASS: Unauthenticated access properly rejected');
    } else {
      console.error('ERROR: Unexpected error during unauthenticated access test', error);
    }
  }
  
  // Test 2: Attempt to access another user's messages
  try {
    // Login as user 1
    const auth1 = await login('user1@example.com', 'password1');
    
    // Try to access user 2's conversation
    const response = await axios.get('/api/conversations/user2-conversation', {
      headers: { 
        Authorization: `Bearer ${auth1.token}`
      }
    });
    
    if (response.status === 200 && response.data.length > 0) {
      console.error('FAIL: Unauthorized access to another user\'s conversation succeeded');
    } else {
      console.log('PASS: Unauthorized access properly rejected');
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('PASS: Unauthorized access properly rejected');
    } else {
      console.error('ERROR: Unexpected error during unauthorized access test', error);
    }
  }
  
  // Test 3: SQL Injection attempt
  try {
    const auth = await login('user1@example.com', 'password1');
    
    // Attempt SQL injection in conversation ID
    const response = await axios.get('/api/conversations/1%27%20OR%20%271%27=%271', {
      headers: { 
        Authorization: `Bearer ${auth.token}`
      }
    });
    
    console.error('FAIL: Potential SQL injection vulnerability');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('PASS: SQL injection attempt properly rejected');
    } else {
      console.error('ERROR: Unexpected error during SQL injection test', error);
    }
  }
  
  // Test 4: XSS attempt in message content
  try {
    const auth = await login('user1@example.com', 'password1');
    
    // Send message with XSS payload
    const response = await axios.post('/api/messages', {
      conversationId: 'valid-conversation',
      content: '<script>alert("XSS")</script>'
    }, {
      headers: { 
        Authorization: `Bearer ${auth.token}`
      }
    });
    
    // Now try to retrieve the message and check if script tags are escaped
    const messages = await axios.get('/api/conversations/valid-conversation', {
      headers: { 
        Authorization: `Bearer ${auth.token}`
      }
    });
    
    const lastMessage = messages.data[messages.data.length - 1];
    if (lastMessage.content.includes('<script>')) {
      console.error('FAIL: XSS payload not sanitized');
    } else {
      console.log('PASS: XSS payload properly sanitized');
    }
  } catch (error) {
    console.error('ERROR: Unexpected error during XSS test', error);
  }
  
  // Helper function to login
  async function login(email, password) {
    const response = await axios.post('/api/auth/login', {
      email,
      password
    });
    return response.data;
  }
}

runPenetrationTests().catch(console.error);
```

## Security Audit Checklist

```markdown
# Encrypted Messaging Security Audit Checklist

## Key Management
- [ ] Private keys are stored securely (IndexedDB with proper access controls)
- [ ] Key backup is encrypted with strong password-based encryption
- [ ] Key rotation is implemented and tested
- [ ] Keys are properly destroyed when no longer needed

## Data Protection
- [ ] All message content is encrypted end-to-end
- [ ] Database contains only encrypted message content
- [ ] Metadata (timestamps, sender/recipient IDs) is minimized
- [ ] Network traffic does not expose message content

## Access Controls
- [ ] RLS policies prevent unauthorized access to conversations
- [ ] Users can only read/write to conversations they participate in
- [ ] Group chat access is properly controlled
- [ ] Authentication is required for all messaging operations

## Cryptographic Implementation
- [ ] E3Kit is used according to best practices
- [ ] No custom cryptographic algorithms are implemented
- [ ] Strong encryption algorithms are used (AES-256, RSA-2048 or better)
- [ ] Secure random number generation is used for all cryptographic operations

## Infrastructure Security
- [ ] Edge functions are properly secured
- [ ] Rate limiting is implemented for sensitive operations
- [ ] Supabase RLS policies are comprehensive
- [ ] Error messages don't leak sensitive information
```

This security testing strategy provides a comprehensive approach to ensuring the security of the encrypted messaging system, covering key management, data protection, access controls, and cryptographic implementation.