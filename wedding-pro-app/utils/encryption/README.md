# End-to-End Encryption Implementation

This directory contains the implementation of end-to-end encryption for the Wedding Pro application using Virgil Security's E3Kit. The encryption is used for secure direct messaging and group chats.

## Overview

The encryption implementation provides:

- End-to-end encryption for direct messages between users
- End-to-end encryption for group chats (job threads)
- Identity verification to prevent man-in-the-middle attacks
- Secure key management

## Files

- `encryption-service.ts`: Core encryption functionality using Virgil Security's E3Kit
- `encryption-utils.ts`: Simplified interface for using encryption in the application
- `encryption-example.ts`: Example usage of the encryption utilities

## Backend Components

- `supabase/functions/get-virgil-jwt/index.ts`: Supabase Edge Function for generating Virgil JWT tokens
- `scripts/encrypted-messaging-migration.sql`: SQL migration for the group chat tickets table

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Virgil Security
NEXT_PUBLIC_VIRGIL_APP_ID=your-virgil-app-id
VIRGIL_API_KEY=your-virgil-api-key
```

### 2. Deploy the Supabase Edge Function

Deploy the `get-virgil-jwt` Edge Function to your Supabase project:

```bash
cd wedding-pro-app
npx supabase functions deploy get-virgil-jwt
```

### 3. Run the Database Migration

Apply the SQL migration to create the necessary tables:

```bash
cd wedding-pro-app
npx supabase db push
```

## Usage

### Initializing Encryption

Before using encryption, you need to initialize it for the current user:

```typescript
import { initializeEncryption } from '@/utils/encryption/encryption-utils';

// Initialize encryption for the current user
const encryption = await initializeEncryption(currentUserId);
```

### Sending an Encrypted Direct Message

```typescript
// Encrypt a message for a specific recipient
const encryptedContent = await encryption.encryptMessage(message, [recipientId]);

// Store the encrypted message in the database
await supabase
  .from('messages')
  .insert({
    sender_id: currentUserId,
    conversation_id: conversationId,
    encrypted_content: encryptedContent,
    message_type: 'text',
  });
```

### Receiving and Decrypting a Direct Message

```typescript
// Get the encrypted message from the database
const { data: message } = await supabase
  .from('messages')
  .select('encrypted_content, sender_id')
  .eq('id', messageId)
  .single();

// Decrypt the message
const decryptedMessage = await encryption.decryptMessage(
  message.encrypted_content,
  message.sender_id
);
```

### Creating an Encrypted Group Chat

```typescript
// Create the group chat in the database
const { data: groupChat } = await supabase
  .from('group_chats')
  .insert({
    name: groupName,
    created_by: currentUserId,
  })
  .select()
  .single();

// Add participants to the group chat
const participants = participantIds.map(participantId => ({
  group_chat_id: groupChat.id,
  user_id: participantId,
}));

await supabase
  .from('group_chat_participants')
  .insert(participants);

// Initialize the encryption group
await encryption.createGroupChat(groupChat.id, participantIds);
```

### Sending an Encrypted Group Message

```typescript
// Encrypt the message for the group
const encryptedContent = await encryption.encryptGroupMessage(groupId, message);

// Store the encrypted message in the database
await supabase
  .from('messages')
  .insert({
    sender_id: currentUserId,
    group_chat_id: groupId,
    encrypted_content: encryptedContent,
    message_type: 'text',
  });
```

### Receiving and Decrypting a Group Message

```typescript
// Get the encrypted message from the database
const { data: message } = await supabase
  .from('messages')
  .select('encrypted_content, group_chat_id')
  .eq('id', messageId)
  .single();

// Decrypt the message
const decryptedMessage = await encryption.decryptGroupMessage(
  message.group_chat_id,
  message.encrypted_content
);
```

### Verifying User Identity

To prevent man-in-the-middle attacks, users can verify each other's identities by comparing verification strings:

```typescript
// Get the verification string for a user
const verificationString = await encryption.getIdentityVerificationString(otherUserId);

// Verify a user's identity
const isVerified = await encryption.verifyIdentity(otherUserId, verificationString);
```

## Security Considerations

- **Key Management**: Private keys are securely stored by Virgil Security's E3Kit.
- **Identity Verification**: Users should verify each other's identities to prevent man-in-the-middle attacks.
- **Group Chat Security**: Group chats use a shared encryption key that is securely distributed to all participants.
- **API Keys**: Keep your Virgil API key secure and never expose it in client-side code.

## References

- [Virgil Security E3Kit Documentation](https://developer.virgilsecurity.com/docs/e3kit/)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)