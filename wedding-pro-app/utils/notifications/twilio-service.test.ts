import { TwilioService, SMSMessage, SMSResponse } from './twilio-service';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * This file demonstrates how to use the TwilioService
 * 
 * Note: This is not an actual test file that would be run with Jest or Vitest.
 * It's a demonstration of how to use the TwilioService in your application.
 */

// Example 1: Creating a TwilioService instance manually
function exampleManualCreation() {
  // In a real application, these would come from environment variables
  const twilioConfig = {
    accountSid: 'YOUR_ACCOUNT_SID',
    authToken: 'YOUR_AUTH_TOKEN',
    fromNumber: '+15551234567',
  };

  // Create the service
  const twilioService = new TwilioService(twilioConfig);

  // Example message
  const message: SMSMessage = {
    to: '+15557654321',
    body: 'Hello from Wedding Pro! Your job assignment has been confirmed.',
  };

  // Send the message
  twilioService.sendSMS(message)
    .then((response: SMSResponse) => {
      if (response.success) {
        console.log('Message sent successfully!', response.messageId);
      } else {
        console.error('Failed to send message:', response.error?.message);
      }
    })
    .catch((error) => {
      console.error('Error sending message:', error);
    });
}

// Example 2: Using the singleton instance (recommended approach)
async function exampleSingletonUsage() {
  // Import the singleton getter
  const { getTwilioService } = require('./twilio-service');

  try {
    // Get the service (it will be created with environment variables)
    const twilioService = getTwilioService();

    // Send a message
    const response = await twilioService.sendSMS({
      to: '+15557654321',
      body: 'Your upcoming wedding job has been scheduled for tomorrow at 2 PM.',
    });

    // Handle the response
    if (response.success) {
      console.log('Notification sent successfully!');
      console.log('Message ID:', response.messageId);
      console.log('Status:', response.status);
    } else {
      console.error('Failed to send notification:');
      console.error('Error:', response.error?.message);
      console.error('Status:', response.status);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Example 3: Using the notification service (which uses Twilio internally)
async function exampleNotificationService() {
  // Import the notification service
  const { createNotificationService } = require('./notification-service');
  const { createClient } = require('@supabase/supabase-js');

  // Create a Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create the notification service
  const notificationService = createNotificationService(supabase);

  // Send an SMS notification
  const result = await notificationService.sendNotification({
    userId: 'user-123',
    title: 'Job Assignment',
    body: 'You have been assigned to a new wedding job on June 15th.',
    channel: 'sms',
    metadata: {
      jobId: 'job-456',
      jobTitle: 'Wedding Photographer',
      jobDate: '2025-06-15',
    },
  });

  // Handle the result
  if (result.success) {
    console.log('Notification sent successfully!');
    console.log('Notification ID:', result.notificationId);
    console.log('Status:', result.status);
  } else {
    console.error('Failed to send notification:');
    console.error('Error:', result.error);
    console.error('Channel:', result.channel);
  }
}

// Example usage in a Next.js API route
export async function exampleApiRouteHandler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Import the notification service
    const { createNotificationService } = require('./notification-service');
    const { createClient } = require('@supabase/supabase-js');

    // Create a Supabase client (server-side)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create the notification service
    const notificationService = createNotificationService(supabase);

    // Send the notification
    const result = await notificationService.sendSMSNotification(
      userId,
      { title: 'Notification', body: message },
      { source: 'api' }
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        notificationId: result.notificationId,
        status: result.status,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        channel: result.channel,
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}