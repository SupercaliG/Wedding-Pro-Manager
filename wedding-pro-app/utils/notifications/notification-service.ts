import { createClient } from '@supabase/supabase-js';
import { getTwilioService } from './twilio-service';
import { getResendService } from './resend-service';
import { Database } from '../../types/supabase';
import { getNotificationLogger } from './get-notification-logger';

// Define notification types
export type NotificationChannel = 'sms' | 'email' | 'in-app' | 'multi';

export type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  metadata?: Record<string, any>;
};

export type NotificationResult = {
  success: boolean;
  notificationId?: string;
  error?: string;
  channel: NotificationChannel;
  status?: string;
};

/**
 * Notification event types
 */
export type NotificationEventType =
  | 'job_assignment'          // When a user is assigned to a job
  | 'job_completed'           // When a job is marked as complete
  | 'drop_request_created'    // When a drop request is created
  | 'drop_request_approved'   // When a drop request is approved
  | 'drop_request_rejected'   // When a drop request is rejected
  | 'job_interest_expressed'  // When an employee expresses interest in a job
  | 'job_interest_withdrawn'  // When an employee withdraws interest in a job
  | 'user_approved'           // When a user's account is approved
  | 'user_rejected'           // When a user's account is rejected
  | 'org_announcement';       // When an organization makes an announcement

/**
 * Notification event payload
 */
export type NotificationEvent = {
  eventType: NotificationEventType;
  userId: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
};

/**
 * Service for sending notifications through various channels
 */
export class NotificationService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Send an SMS notification
   * @param userId The user ID to send the notification to
   * @param message The message to send
   * @param metadata Additional metadata for the notification
   * @returns A promise that resolves to a NotificationResult
   */
  async sendSMSNotification(
    userId: string,
    message: { title: string; body: string },
    metadata: Record<string, any> = {},
    userProfile?: any
  ): Promise<NotificationResult> {
    try {
      // 1. Get the user's profile if not provided
      let profile = userProfile;
      if (!profile) {
        const { profile: fetchedProfile, error: profileError } = await this.getUserProfileWithPreferences(userId);
        
        if (profileError || !fetchedProfile) {
          return {
            success: false,
            error: profileError?.message || 'User not found',
            channel: 'sms',
          };
        }
        
        profile = fetchedProfile;
      }

      // 2. Check if the user has SMS notifications enabled
      const notificationPreferences = profile.notification_preferences as Record<string, boolean>;
      if (!notificationPreferences?.sms) {
        return {
          success: false,
          error: 'SMS notifications are disabled for this user',
          channel: 'sms',
          status: 'disabled',
        };
      }

      // 3. Validate the phone number
      const phoneNumber = profile.phone_number;
      if (!phoneNumber) {
        return {
          success: false,
          error: 'User does not have a phone number',
          channel: 'sms',
        };
      }

      // 4. Create a notification record in the database
      const { data: notification, error: notificationError } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: message.title,
          content: message.body,
          channel: 'sms',
          status: 'pending',
          metadata: {
            ...metadata,
            phone_number: phoneNumber,
          },
        })
        .select()
        .single();

      if (notificationError) {
        console.error('Failed to create notification record:', notificationError);
        return {
          success: false,
          error: notificationError.message,
          channel: 'sms',
        };
      }

      // 5. Send the SMS using Twilio
      const twilioService = getTwilioService(this.supabase);
      const smsResponse = await twilioService.sendSMS(
        {
          to: phoneNumber,
          body: message.body,
        },
        userId,
        metadata?.eventType
      );

      // 6. Update the notification record with the result
      const { error: updateError } = await this.supabase
        .from('notifications')
        .update({
          status: smsResponse.success ? 'delivered' : 'failed',
          metadata: {
            ...notification.metadata,
            twilioMessageId: smsResponse.messageId,
            twilioStatus: smsResponse.status,
            twilioError: smsResponse.error,
          },
        })
        .eq('id', notification.id);

      if (updateError) {
        console.error('Failed to update notification status:', updateError);
      }

      return {
        success: smsResponse.success,
        notificationId: notification.id,
        error: smsResponse.error?.message,
        channel: 'sms',
        status: smsResponse.status,
      };
    } catch (error: any) {
      console.error('Error sending SMS notification:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending SMS notification',
        channel: 'sms',
      };
    }
  }

  /**
   * Send an email notification
   * @param userId The user ID to send the notification to
   * @param message The message to send
   * @param metadata Additional metadata for the notification
   * @returns A promise that resolves to a NotificationResult
   */
  async sendEmailNotification(
    userId: string,
    message: { title: string; body: string },
    metadata: Record<string, any> = {},
    userProfile?: any
  ): Promise<NotificationResult> {
    try {
      // 1. Get the user's profile if not provided
      let profile = userProfile;
      if (!profile) {
        const { profile: fetchedProfile, error: profileError } = await this.getUserProfileWithPreferences(userId);
        
        if (profileError || !fetchedProfile) {
          return {
            success: false,
            error: profileError?.message || 'User not found',
            channel: 'email',
          };
        }
        
        profile = fetchedProfile;
      }

      // 2. Check if the user has email notifications enabled
      const notificationPreferences = profile.notification_preferences as Record<string, boolean>;
      if (!notificationPreferences?.email) {
        return {
          success: false,
          error: 'Email notifications are disabled for this user',
          channel: 'email',
          status: 'disabled',
        };
      }

      // 3. Validate the email address
      const email = profile.email;
      if (!email) {
        return {
          success: false,
          error: 'User does not have an email address',
          channel: 'email',
        };
      }

      // 4. Create a notification record in the database
      const { data: notification, error: notificationError } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: message.title,
          content: message.body,
          channel: 'email',
          status: 'pending',
          metadata: {
            ...metadata,
            email_address: email,
          },
        })
        .select()
        .single();

      if (notificationError) {
        console.error('Failed to create notification record:', notificationError);
        return {
          success: false,
          error: notificationError.message,
          channel: 'email',
        };
      }

      // 5. Send the email using Resend
      const resendService = getResendService(this.supabase);
      const emailResponse = await resendService.sendEmail(
        {
          to: email,
          subject: message.title,
          html: message.body,
        },
        userId,
        metadata?.eventType
      );

      // 6. Update the notification record with the result
      const { error: updateError } = await this.supabase
        .from('notifications')
        .update({
          status: emailResponse.success ? 'delivered' : 'failed',
          metadata: {
            ...notification.metadata,
            resendMessageId: emailResponse.messageId,
            resendStatus: emailResponse.status,
            resendError: emailResponse.error,
          },
        })
        .eq('id', notification.id);

      if (updateError) {
        console.error('Failed to update notification status:', updateError);
      }

      return {
        success: emailResponse.success,
        notificationId: notification.id,
        error: emailResponse.error?.message,
        channel: 'email',
        status: emailResponse.status,
      };
    } catch (error: any) {
      console.error('Error sending email notification:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending email notification',
        channel: 'email',
      };
    }
  }

  /**
   * Send an in-app notification
   * @param userId The user ID to send the notification to
   * @param message The message to send
   * @param metadata Additional metadata for the notification
   * @returns A promise that resolves to a NotificationResult
   */
  async sendInAppNotification(
    userId: string,
    message: { title: string; body: string },
    metadata: Record<string, any> = {},
    userProfile?: any
  ): Promise<NotificationResult> {
    // Get logger
    const logger = getNotificationLogger(this.supabase);
    
    // Extract event type from metadata if available
    const eventType = metadata?.eventType;
    
    // Log attempt
    await logger.logAttempt(
      'in-app',
      userId,
      eventType,
      {
        title: message.title,
        metadata: JSON.stringify(metadata)
      }
    );
    
    try {
      // Validate inputs
      if (!userId) {
        const errorMessage = 'Missing required userId for in-app notification';
        
        await logger.logFailure(
          'in-app',
          'VALIDATION_ERROR',
          errorMessage,
          userId,
          eventType
        );
        
        return {
          success: false,
          error: errorMessage,
          channel: 'in-app',
        };
      }
      
      // 1. Get the user's profile if not provided
      let profile = userProfile;
      if (!profile) {
        const { profile: fetchedProfile, error: profileError } = await this.getUserProfileWithPreferences(userId);
        
        if (profileError || !fetchedProfile) {
          const errorMessage = profileError?.message || 'User not found';
          
          await logger.logFailure(
            'in-app',
            'USER_NOT_FOUND',
            errorMessage,
            userId,
            eventType,
            { error: profileError }
          );
          
          return {
            success: false,
            error: errorMessage,
            channel: 'in-app',
          };
        }
        
        profile = fetchedProfile;
      }

      // 2. Check if the user has in-app notifications enabled
      const notificationPreferences = profile.notification_preferences as Record<string, boolean>;
      if (!notificationPreferences?.['in-app']) {
        // This is not a failure, just a user preference
        return {
          success: false,
          error: 'In-app notifications are disabled for this user',
          channel: 'in-app',
          status: 'disabled',
        };
      }

      // 3. Create a notification record in the database
      const { data: notification, error: notificationError } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: message.title,
          content: message.body,
          channel: 'in-app',
          status: 'delivered', // In-app notifications are delivered immediately
          read: false, // Mark as unread by default
          metadata: {
            ...metadata,
            delivered_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (notificationError) {
        console.error('Failed to create in-app notification record:', notificationError);
        
        // Categorize database errors
        let errorCode = 'DB_ERROR';
        if (notificationError.code) {
          if (notificationError.code === '23505') errorCode = 'DUPLICATE_RECORD';
          else if (notificationError.code === '23503') errorCode = 'FOREIGN_KEY_VIOLATION';
          else if (notificationError.code === '42P01') errorCode = 'UNDEFINED_TABLE';
          else if (notificationError.code === '42703') errorCode = 'UNDEFINED_COLUMN';
        }
        
        await logger.logFailure(
          'in-app',
          errorCode,
          notificationError.message,
          userId,
          eventType,
          {
            error: notificationError.details,
            title: message.title
          }
        );
        
        return {
          success: false,
          error: notificationError.message,
          channel: 'in-app',
        };
      }

      // Log success
      await logger.logSuccess(
        'in-app',
        userId,
        eventType,
        notification.id,
        {
          title: message.title,
          notificationId: notification.id
        }
      );
      
      return {
        success: true,
        notificationId: notification.id,
        channel: 'in-app',
        status: 'delivered',
      };
    } catch (error: any) {
      console.error('Error sending in-app notification:', error);
      
      await logger.logFailure(
        'in-app',
        'EXCEPTION',
        error.message || 'Unknown error sending in-app notification',
        userId,
        eventType,
        {
          error: error.stack,
          title: message.title
        }
      );
      
      return {
        success: false,
        error: error.message || 'Unknown error sending in-app notification',
        channel: 'in-app',
      };
    }
  }

  /**
   * Send a notification through the specified channel
   * @param payload The notification payload
   * @returns A promise that resolves to a NotificationResult
   */
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    // Get logger
    const logger = getNotificationLogger(this.supabase);
    
    // Extract event type from metadata if available
    const eventType = payload.metadata?.eventType;
    
    try {
      // Validate inputs
      if (!payload.userId) {
        const errorMessage = 'Missing required userId for notification';
        
        await logger.logFailure(
          payload.channel,
          'VALIDATION_ERROR',
          errorMessage,
          payload.userId, // Will be null/undefined here, but pass for consistency
          eventType
        );
        
        return {
          success: false,
          error: errorMessage,
          channel: payload.channel,
        };
      }
      
      // Get user profile and preferences once
      const { profile, error: profileError } = await this.getUserProfileWithPreferences(payload.userId);
      if (profileError || !profile) {
        const errorMessage = profileError?.message || 'User not found';
        
        await logger.logFailure(
          payload.channel,
          'USER_NOT_FOUND',
          errorMessage,
          payload.userId,
          eventType,
          { error: profileError }
        );
        
        return {
          success: false,
          error: errorMessage,
          channel: payload.channel,
        };
      }

      // Format message based on channel (placeholder for now)
      const formattedMessage = this.formatMessageForChannel(
        payload.channel,
        payload.title,
        payload.body
      );

      switch (payload.channel) {
        case 'sms':
          return this.sendSMSNotification(payload.userId, formattedMessage, payload.metadata, profile);
        case 'email':
          return this.sendEmailNotification(payload.userId, formattedMessage, payload.metadata, profile);
        case 'in-app':
          return this.sendInAppNotification(payload.userId, formattedMessage, payload.metadata, profile);
        default:
          const errorMessage = `Unsupported channel: ${payload.channel}`;
          
          await logger.logFailure(
            payload.channel,
            'UNSUPPORTED_CHANNEL',
            errorMessage,
            payload.userId,
            eventType
          );
          
          return {
            success: false,
            error: errorMessage,
            channel: payload.channel,
          };
      }
    } catch (error: any) {
      console.error(`Error sending ${payload.channel} notification:`, error);
      
      await logger.logFailure(
        payload.channel,
        'EXCEPTION',
        error.message || `Unknown error sending ${payload.channel} notification`,
        payload.userId,
        eventType,
        { error: error.stack }
      );
      
      return {
        success: false,
        error: error.message || `Unknown error sending ${payload.channel} notification`,
        channel: payload.channel,
      };
    }
  }

  /**
   * Get user profile along with their notification preferences and email.
   * This is a helper to avoid multiple fetches.
   */
  private async getUserProfileWithPreferences(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        id,
        email,
        phone_number,
        notification_preferences
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile with preferences:', error);
      return { profile: null, error };
    }
    return { profile: data, error: null };
  }

  /**
   * Formats the message title and body based on the channel.
   * (Placeholder - can be expanded for channel-specific formatting)
   */
  private formatMessageForChannel(
    channel: NotificationChannel,
    title: string,
    body: string
  ): { title: string; body: string } {
    switch (channel) {
      case 'sms':
        // SMS might prefer shorter messages or no title
        return { title: '', body: `${title}: ${body}`.substring(0, 1600) }; // Max SMS length
      // case 'email':
      // Email can handle HTML, longer content, etc.
      // return { title, body }; // Default for now
      case 'in-app':
      default:
        return { title, body };
    }
  }


  /**
   * Send a notification for a specific event type.
   * This method determines the appropriate channels based on user preferences
   * and event type, then sends the notification.
   */
  async sendNotificationForEvent(event: NotificationEvent): Promise<NotificationResult[]> {
    const { eventType, userId, title, body, metadata } = event;
    const results: NotificationResult[] = [];

    // Get logger
    const logger = getNotificationLogger(this.supabase);

    try {
      const { profile, error: profileError } = await this.getUserProfileWithPreferences(userId);
      if (profileError || !profile) {
        const errorMessage = profileError?.message || 'User not found for event notification';
        
        await logger.logFailure(
          'multi', // Channel is multi as it's event-based
          'USER_NOT_FOUND_FOR_EVENT',
          errorMessage,
          userId,
          eventType,
          { error: profileError, title }
        );
        
        return [{ success: false, error: errorMessage, channel: 'multi' }];
      }

      const preferences = profile.notification_preferences as Record<string, any> || {};
      
      // Determine which channels are enabled for this event type or generally
      // This logic can be expanded (e.g., event-specific preferences)
      const channels: NotificationChannel[] = [];
      if (preferences.email) channels.push('email');
      if (preferences.sms) channels.push('sms');
      if (preferences['in-app']) channels.push('in-app');
      // Add more complex logic here if needed, e.g., based on eventType

      if (channels.length === 0) {
        await logger.logSkipped(
          'multi',
          'NO_CHANNELS_ENABLED',
          'No notification channels enabled for user or event.',
          userId,
          eventType,
          { title }
        );
        return [{ success: false, error: 'No channels enabled for this user/event', channel: 'multi', status: 'disabled' }];
      }

      const channelPromises = channels.map(async (channel) => {
        const formattedMessage = this.formatMessageForChannel(channel, title, body);
        return this.sendNotification({
          userId,
          title: formattedMessage.title,
          body: formattedMessage.body,
          channel,
          metadata: { ...metadata, eventType }, // Ensure eventType is in metadata
        });
      });

      const channelResults = await Promise.all(channelPromises);
      results.push(...channelResults);

      // Log overall event notification attempt and results
      const allSuccessful = results.every(r => r.success || r.status === 'disabled');
      if (allSuccessful) {
        await logger.logSuccess(
          'multi',
          userId,
          eventType,
          results.find(r => r.notificationId)?.notificationId || 'N/A', // Use first available ID
          { 
            title, 
            channelsAttempted: channels,
            results: JSON.stringify(results.map(r => ({ channel: r.channel, success: r.success, status: r.status, error: r.error?.substring(0,100) }))) 
          }
        );
      } else {
        await logger.logFailure(
          'multi',
          'PARTIAL_FAILURE_EVENT',
          'One or more channels failed for event notification.',
          userId,
          eventType,
          { 
            title, 
            channelsAttempted: channels,
            results: JSON.stringify(results.map(r => ({ channel: r.channel, success: r.success, status: r.status, error: r.error?.substring(0,100) })))
          }
        );
      }

    } catch (error: any) {
      console.error(`Error processing event notification ${eventType} for user ${userId}:`, error);
      
      await logger.logFailure(
        'multi',
        'EXCEPTION_EVENT',
        error.message || `Unknown error processing event ${eventType}`,
        userId,
        eventType,
        { error: error.stack, title }
      );
      
      results.push({ success: false, error: error.message, channel: 'multi' });
    }
    return results;
  }


  /**
   * Sends a notification to multiple users across multiple preferred channels.
   * This is a higher-level function useful for things like announcements.
   * 
   * @param userIds Array of user IDs to notify.
   * @param title The title of the notification.
   * @param body The body/content of the notification.
   * @param metadata Optional metadata, including eventType.
   * @returns A promise that resolves to an array of results, one for each user-channel combination.
   */
  async sendMultiChannelNotification(
    userIds: string[],
    title: string,
    body: string,
    metadata: Record<string, any> = {} // eventType should be in metadata if applicable
  ): Promise<NotificationResult[]> {
    const allResults: NotificationResult[] = [];
    const logger = getNotificationLogger(this.supabase);
    const eventType = metadata.eventType || 'batch_notification'; // Default eventType

    for (const userId of userIds) {
      try {
        const { profile, error: profileError } = await this.getUserProfileWithPreferences(userId);
        if (profileError || !profile) {
          const errorMessage = profileError?.message || `User ${userId} not found for multi-channel notification.`;
          logger.logFailure('multi-user', 'USER_NOT_FOUND_BATCH', errorMessage, userId, eventType, { title });
          allResults.push({ success: false, error: errorMessage, channel: 'multi-user', userId });
          continue;
        }

        const preferences = profile.notification_preferences as Record<string, any> || {};
        const channelsToTry: NotificationChannel[] = [];
        if (preferences.email) channelsToTry.push('email');
        if (preferences.sms) channelsToTry.push('sms');
        if (preferences['in-app']) channelsToTry.push('in-app');

        if (channelsToTry.length === 0) {
          logger.logSkipped('multi-user', 'NO_CHANNELS_ENABLED_BATCH', `No channels for user ${userId}.`, userId, eventType, { title });
          allResults.push({ success: false, error: 'No channels enabled', channel: 'multi-user', userId, status: 'disabled' });
          continue;
        }

        const userChannelPromises = channelsToTry.map(channel => {
          const formattedMessage = this.formatMessageForChannel(channel, title, body);
          return this.sendNotification({
            userId,
            title: formattedMessage.title,
            body: formattedMessage.body,
            channel,
            metadata, // Pass along original metadata
          });
        });
        
        const userResults = await Promise.all(userChannelPromises);
        allResults.push(...userResults.map(r => ({ ...r, userId }))); // Add userId to each result for context

        // Log per-user summary for multi-user batch
        const userOverallSuccess = userResults.every(r => r.success || r.status === 'disabled');
        if (userOverallSuccess) {
          logger.logSuccess('multi-user', userId, eventType, 'N/A', {
            title,
            channelsAttempted: channelsToTry,
            results: JSON.stringify(userResults.map(r => ({ channel: r.channel, success: r.success, status: r.status })))
          });
        } else {
          logger.logFailure('multi-user', 'PARTIAL_FAILURE_BATCH_USER', `Failures for user ${userId}.`, userId, eventType, {
            title,
            channelsAttempted: channelsToTry,
            results: JSON.stringify(userResults.map(r => ({ channel: r.channel, success: r.success, status: r.status, error: r.error?.substring(0,100) })))
          });
        }

      } catch (error: any) {
        const errorMessage = error.message || `Unknown error for user ${userId} in multi-channel batch.`;
        logger.logFailure('multi-user', 'EXCEPTION_BATCH_USER', errorMessage, userId, eventType, { title, error: error.stack });
        allResults.push({ success: false, error: errorMessage, channel: 'multi-user', userId });
      }
    }
    return allResults;
  }
}

/**
 * Factory function to create a NotificationService instance
 * @param supabaseClient Optional Supabase client instance
 * @returns A NotificationService instance
 */
export function createNotificationService(
  supabaseClient?: ReturnType<typeof createClient<Database>>
): NotificationService {
  const client = supabaseClient || createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return new NotificationService(client);
}