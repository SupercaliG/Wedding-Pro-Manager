# Notification System

This directory contains the implementation of the Wedding Pro notification system, which supports multiple notification channels:

- SMS (via Twilio)
- Email (via Resend)
- In-app notifications (to be implemented)

## Architecture

The notification system is built with a modular architecture that allows for easy extension to support additional channels:

- `notification-service.ts`: The main service that orchestrates sending notifications through different channels
- `twilio-service.ts`: Implementation of the SMS notification channel using Twilio
- `resend-service.ts`: Implementation of the email notification channel using Resend

## Database Schema

The notification system uses the following database tables:

- `notifications`: Stores all notifications sent to users
- `profiles`: Contains user information including phone numbers and notification preferences

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=your_twilio_phone_number

# Resend Email Configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=notifications@yourdomain.com
RESEND_FROM_NAME=Wedding Pro
```

### 2. Database Migration

Run the database migration to add the necessary columns to your database:

```sql
-- This is already included in notifications-sms-migration.sql
```

## Usage

### Sending SMS Notifications

```typescript
import { createClient } from '@supabase/supabase-js';
import { createNotificationService } from './notification-service';

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Create the notification service
const notificationService = createNotificationService(supabase);

// Send an SMS notification
async function sendJobAssignmentNotification(userId: string, jobDetails: any) {
  const result = await notificationService.sendNotification({
    userId,
    title: 'Job Assignment',
    body: `You have been assigned to ${jobDetails.title} on ${jobDetails.date}.`,
    channel: 'sms',
    metadata: {
      jobId: jobDetails.id,
      jobTitle: jobDetails.title,
      jobDate: jobDetails.date,
    },
  });

  return result;
}
```

### Sending Email Notifications

```typescript
import { createClient } from '@supabase/supabase-js';
import { createNotificationService } from './notification-service';

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Create the notification service
const notificationService = createNotificationService(supabase);

// Send an email notification
async function sendJobAssignmentEmail(userId: string, jobDetails: any) {
  const result = await notificationService.sendNotification({
    userId,
    title: 'Job Assignment',
    body: `<h1>New Assignment</h1><p>You have been assigned to ${jobDetails.title} on ${jobDetails.date}.</p>`,
    channel: 'email',
    metadata: {
      jobId: jobDetails.id,
      jobTitle: jobDetails.title,
      jobDate: jobDetails.date,
    },
  });

  return result;
}
```

### Direct Usage of Service APIs

If you need more control over the notification sending process, you can use the services directly:

```typescript
// For SMS
import { getTwilioService } from './twilio-service';

// Get the Twilio service instance
const twilioService = getTwilioService();

// Send an SMS
async function sendDirectSMS(phoneNumber: string, message: string) {
  const response = await twilioService.sendSMS({
    to: phoneNumber,
    body: message,
  });

  return response;
}

// For Email
import { getResendService } from './resend-service';

// Get the Resend service instance
const resendService = getResendService();

// Send an email
async function sendDirectEmail(email: string, subject: string, htmlContent: string) {
  const response = await resendService.sendEmail({
    to: email,
    subject: subject,
    html: htmlContent,
  });

  return response;
}
```

## Error Handling

The notification system includes built-in error handling and retry mechanisms:

- Transient errors (network issues, rate limiting) are automatically retried
- Permanent errors (invalid phone number, authentication failure) are reported back
- All notification attempts are logged in the database with their status

## User Preferences

Users can control which notification channels they receive through the `notification_preferences` field in their profile:

```json
{
  "sms": true,
  "email": true,
  "in-app": true
}
```

The notification service respects these preferences and will not send notifications through disabled channels.

## Testing

See `twilio-service.test.ts` for examples of how to use the notification system in different contexts.

## Future Enhancements

- Implement in-app notification channel
- Add support for notification templates
- Add support for scheduled notifications
- Add support for batch notifications