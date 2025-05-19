/**
 * Test script for the Resend email service
 * 
 * This script demonstrates how to use the Resend service to send an email.
 * 
 * To run this script:
 * 1. Make sure you have set the required environment variables in .env:
 *    - RESEND_API_KEY
 *    - RESEND_FROM_EMAIL
 *    - RESEND_FROM_NAME
 * 
 * 2. Run the script with:
 *    npx ts-node -r dotenv/config utils/notifications/test-email.ts
 */

import { getResendService } from './resend-service';

async function testResendEmail() {
  try {
    console.log('Testing Resend email service...');
    
    // Get the Resend service instance
    const resendService = getResendService();
    
    // Test email details
    const testEmail = {
      to: 'test@example.com', // Replace with a real email for testing
      subject: 'Wedding Pro - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4a154b;">Wedding Pro Test Email</h1>
          <p>This is a test email from the Wedding Pro notification system.</p>
          <p>If you're receiving this, the Resend email integration is working correctly!</p>
          <div style="background-color: #f6f6f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Test Details:</strong></p>
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
          </div>
          <p>Thank you,<br>Wedding Pro Team</p>
        </div>
      `,
      text: 'This is a test email from the Wedding Pro notification system. If you\'re receiving this, the Resend email integration is working correctly!',
    };
    
    console.log(`Sending test email to: ${testEmail.to}`);
    
    // Send the test email
    const response = await resendService.sendEmail(testEmail);
    
    // Log the result
    if (response.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', response.messageId);
      console.log('Status:', response.status);
    } else {
      console.error('❌ Failed to send email:');
      console.error('Error:', response.error?.message);
      console.error('Status:', response.status);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testResendEmail();