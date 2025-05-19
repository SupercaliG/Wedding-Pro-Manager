import { ResendService, EmailMessage, EmailResponse } from './resend-service';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * This file demonstrates how to use the ResendService
 * 
 * Note: This is not an actual test file that would be run with Jest or Vitest.
 * It's a demonstration of how to use the ResendService in your application.
 */

// Example 1: Creating a ResendService instance manually
function exampleManualCreation() {
  // In a real application, these would come from environment variables
  const resendConfig = {
    apiKey: 'YOUR_RESEND_API_KEY',
    defaultFromEmail: 'notifications@weddingpro.com',
    defaultFromName: 'Wedding Pro',
  };

  // Create the service
  const resendService = new ResendService(resendConfig);

  // Example message
  const message: EmailMessage = {
    to: 'employee@example.com',
    subject: 'Job Assignment Confirmation',
    html: '<h1>Your job assignment has been confirmed</h1><p>You have been assigned to the Smith wedding on June 15th.</p>',
    text: 'Your job assignment has been confirmed. You have been assigned to the Smith wedding on June 15th.',
  };

  // Send the message
  resendService.sendEmail(message)
    .then((response: EmailResponse) => {
      if (response.success) {
        console.log('Email sent successfully!', response.messageId);
      } else {
        console.error('Failed to send email:', response.error?.message);
      }
    })
    .catch((error) => {
      console.error('Error sending email:', error);
    });
}

// Example 2: Using the singleton instance (recommended approach)
async function exampleSingletonUsage() {
  // Import the singleton getter
  const { getResendService } = require('./resend-service');

  try {
    // Get the service (it will be created with environment variables)
    const resendService = getResendService();

    // Send an email
    const response = await resendService.sendEmail({
      to: 'employee@example.com',
      subject: 'Upcoming Wedding Job',
      html: '<h1>Job Reminder</h1><p>Your upcoming wedding job has been scheduled for tomorrow at 2 PM.</p>',
      text: 'Job Reminder: Your upcoming wedding job has been scheduled for tomorrow at 2 PM.',
    });

    // Handle the response
    if (response.success) {
      console.log('Email notification sent successfully!');
      console.log('Message ID:', response.messageId);
      console.log('Status:', response.status);
    } else {
      console.error('Failed to send email notification:');
      console.error('Error:', response.error?.message);
      console.error('Status:', response.status);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Example 3: Using the notification service (which uses Resend internally)
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

  // Send an email notification
  const result = await notificationService.sendNotification({
    userId: 'user-123',
    title: 'Job Assignment',
    body: '<h1>New Assignment</h1><p>You have been assigned to a new wedding job on June 15th.</p>',
    channel: 'email',
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

// Example 4: Sending a templated email
async function exampleTemplatedEmail() {
  const { getResendService } = require('./resend-service');
  const resendService = getResendService();

  // HTML template with variables
  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4a154b;">Wedding Pro Assignment</h1>
      <p>Hello {{name}},</p>
      <p>You have been assigned to the following job:</p>
      <div style="background-color: #f6f6f6; padding: 15px; border-radius: 5px;">
        <p><strong>Event:</strong> {{eventName}}</p>
        <p><strong>Date:</strong> {{eventDate}}</p>
        <p><strong>Location:</strong> {{eventLocation}}</p>
        <p><strong>Role:</strong> {{role}}</p>
      </div>
      <p>Please confirm your availability by logging into your account.</p>
      <p>Thank you,<br>Wedding Pro Team</p>
    </div>
  `;

  // Data to replace in the template
  const templateData = {
    name: 'John Doe',
    eventName: 'Smith-Johnson Wedding',
    eventDate: 'June 15, 2025 at 2:00 PM',
    eventLocation: 'Grand Plaza Hotel, New York',
    role: 'Photographer',
  };

  // Replace template variables with actual data
  const processedHtml = htmlTemplate.replace(
    /\{\{(\w+)\}\}/g,
    (match, variable) => templateData[variable as keyof typeof templateData] || match
  );

  // Send the email with the processed HTML
  const response = await resendService.sendEmail({
    to: 'employee@example.com',
    subject: 'New Wedding Assignment',
    html: processedHtml,
  });

  console.log(response.success ? 'Templated email sent!' : 'Failed to send templated email');
}

// Example usage in a Next.js API route
export async function exampleApiRouteHandler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, subject, message } = req.body;

  if (!userId || !subject || !message) {
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
    const result = await notificationService.sendEmailNotification(
      userId,
      { title: subject, body: message },
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