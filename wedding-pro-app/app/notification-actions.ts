/**
 * Notification Actions
 *
 * Server actions for sending notifications through various channels.
 * Currently supports SMS notifications via Twilio, email via Resend,
 * and in-app notifications.
 */

'use server';

import { getTwilioService } from '@/utils/notifications/twilio-service';
import { createClient } from '@/utils/supabase/server';
import { createNotificationService } from '@/utils/notifications/notification-service';

// Define the TwilioMessageResponse type
type TwilioMessageResponse = {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  dateCreated: Date;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Send an SMS notification to a user
 * 
 * @param userId - The ID of the user to send the notification to
 * @param message - The message content
 * @returns The Twilio message response
 */
export async function sendSMSNotification(
  userId: string,
  message: string
): Promise<TwilioMessageResponse> {
  try {
    // Get the user's phone number from the database
    const supabase = await createClient();
    
    const { data: user, error } = await supabase
      .from('users')
      .select('phone_number')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      throw new Error(`Failed to fetch user data: ${error?.message || 'User not found'}`);
    }
    
    if (!user.phone_number) {
      throw new Error('User does not have a phone number');
    }
    
    // Initialize the Twilio service
    const twilioService = getTwilioService();
    
    // Send the SMS
    const result = await twilioService.sendSMS({
      to: user.phone_number,
      body: message
    });
    
    // Log the notification in the database for tracking
    await logNotification({
      userId,
      channel: 'sms',
      message,
      status: result.success ? 'delivered' : 'failed',
      metadata: {
        messageSid: result.messageId,
        to: user.phone_number,
        status: result.status,
        error: result.error?.message,
      },
    });
    
    // Convert to TwilioMessageResponse format for backward compatibility
    return {
      sid: result.messageId || '',
      status: result.status || 'failed',
      to: user.phone_number,
      from: '',
      body: message,
      dateCreated: new Date(),
      errorCode: result.error?.code !== undefined ? String(result.error.code) : undefined,
      errorMessage: result.error?.message,
    };
  } catch (error: any) {
    console.error('Error sending SMS notification:', error);
    
    // Return a failed message response
    return {
      sid: '',
      status: 'failed',
      to: '',
      from: '',
      body: message,
      dateCreated: new Date(),
      errorCode: error.code || 'UNKNOWN_ERROR',
      errorMessage: error.message || 'An unknown error occurred',
    };
  }
}

/**
 * Send an SMS notification to a specific phone number
 * 
 * @param phoneNumber - The phone number to send the notification to (E.164 format)
 * @param message - The message content
 * @returns The Twilio message response
 */
export async function sendSMSToPhoneNumber(
  phoneNumber: string,
  message: string
): Promise<TwilioMessageResponse> {
  try {
    // Initialize the Twilio service
    const twilioService = getTwilioService();
    
    // Send the SMS
    const result = await twilioService.sendSMS({
      to: phoneNumber,
      body: message
    });
    
    // Log the notification in the database for tracking (without a user ID)
    await logNotification({
      channel: 'sms',
      message,
      status: result.success ? 'delivered' : 'failed',
      metadata: {
        messageSid: result.messageId,
        to: phoneNumber,
        status: result.status,
        error: result.error?.message,
      },
    });
    
    // Convert to TwilioMessageResponse format for backward compatibility
    return {
      sid: result.messageId || '',
      status: result.status || 'failed',
      to: phoneNumber,
      from: '',
      body: message,
      dateCreated: new Date(),
      errorCode: result.error?.code !== undefined ? String(result.error.code) : undefined,
      errorMessage: result.error?.message,
    };
  } catch (error: any) {
    console.error('Error sending SMS notification:', error);
    
    // Return a failed message response
    return {
      sid: '',
      status: 'failed',
      to: phoneNumber,
      from: '',
      body: message,
      dateCreated: new Date(),
      errorCode: error.code || 'UNKNOWN_ERROR',
      errorMessage: error.message || 'An unknown error occurred',
    };
  }
}

/**
 * Check the status of a sent SMS message
 * 
 * @param messageSid - The SID of the message to check
 * @returns The current status of the message
 */
export async function checkSMSStatus(messageSid: string): Promise<string> {
  try {
    // Initialize the Twilio service
    const twilioService = getTwilioService();
    
    // Check the message status
    const status = await twilioService.checkMessageStatus(messageSid);
    
    // Update the notification log with the current status
    await updateNotificationStatus(messageSid, status);
    
    return status;
  } catch (error: any) {
    console.error(`Error checking SMS status for message ${messageSid}:`, error);
    throw error;
  }
}

/**
 * Log a notification in the database
 * 
 * @param params - The notification data to log
 */
async function logNotification(params: {
  userId?: string;
  channel: 'sms' | 'email' | 'in-app';
  message: string;
  status: string;
  metadata: Record<string, any>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase.from('notifications').insert({
      user_id: params.userId,
      channel: params.channel,
      message: params.message,
      status: params.status,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error('Error logging notification:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Update the status of a notification in the database
 * 
 * @param messageSid - The SID of the message to update
 * @param status - The new status
 */
async function updateNotificationStatus(messageSid: string, status: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase
      .from('notifications')
      .update({ status })
      .eq('metadata->messageSid', messageSid);
  } catch (error) {
    console.error('Error updating notification status:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Send an organization announcement to all users in an organization
 *
 * @param orgId - The ID of the organization
 * @param title - The announcement title
 * @param body - The announcement body
 * @param metadata - Additional metadata for the announcement
 * @returns Success status and any errors
 */
export async function sendOrganizationAnnouncement(
  orgId: string,
  title: string,
  body: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; error?: string; notificationCount?: number }> {
  try {
    const supabase = await createClient();
    
    // Verify the current user is authorized (manager or admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "You must be logged in to send announcements" };
    }
    
    // Get the user's profile to check role and org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      return { success: false, error: "Failed to fetch user profile" };
    }
    
    // Verify the user is a manager or admin in the specified organization
    if (profile.org_id !== orgId || (profile.role !== 'manager' && profile.role !== 'admin')) {
      return { success: false, error: "You must be a manager or admin in this organization to send announcements" };
    }
    
    // Get all users in the organization
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId);
    
    if (orgUsersError || !orgUsers) {
      return { success: false, error: "Failed to fetch organization users" };
    }
    
    if (orgUsers.length === 0) {
      return { success: false, error: "No users found in this organization" };
    }
    
    // Create notification service
    const notificationService = createNotificationService(supabase);
    
    // Send notification to each user
    let successCount = 0;
    let errorCount = 0;
    
    for (const orgUser of orgUsers) {
      try {
        const results = await notificationService.sendNotificationForEvent({
          eventType: 'org_announcement',
          userId: orgUser.id,
          title: title,
          body: body,
          metadata: {
            ...metadata,
            orgId,
            sentBy: user.id,
            sentAt: new Date().toISOString(),
          }
        });
        
        // Check if at least one channel was successful
        if (results.some((result: { success: boolean }) => result.success)) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error sending announcement to user ${orgUser.id}:`, error);
        errorCount++;
      }
    }
    
    return {
      success: successCount > 0,
      error: errorCount > 0 ? `Failed to send announcement to ${errorCount} users` : undefined,
      notificationCount: successCount
    };
  } catch (error: any) {
    console.error('Error sending organization announcement:', error);
    return { success: false, error: error.message || "An unknown error occurred" };
  }
}