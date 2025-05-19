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
          undefined,
          eventType
        );
        
        return {
          success: false,
          error: errorMessage,
          channel: payload.channel,
        };
      }
      
      // First, get the user profile to avoid multiple database calls
      const { profile, error: profileError } = await this.getUserProfileWithPreferences(payload.userId);
      
      if (profileError || !profile) {
        const errorMessage = profileError?.message || 'User not found';
        
        await logger.logFailure(
          payload.channel,
          'USER_NOT_FOUND',
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
      
      // Format the message appropriately for the channel
      const formattedMessage = this.formatMessageForChannel(
        payload.channel,
        { title: payload.title, body: payload.body }
      );
      
      // Send to the appropriate channel, passing the profile to avoid refetching
      switch (payload.channel) {
        case 'sms':
          return this.sendSMSNotification(
            payload.userId,
            formattedMessage,
            payload.metadata,
            profile
          );
        case 'email':
          return this.sendEmailNotification(
            payload.userId,
            formattedMessage,
            payload.metadata,
            profile
          );
        case 'in-app':
          return this.sendInAppNotification(
            payload.userId,
            formattedMessage,
            payload.metadata,
            profile
          );
        default:
          const unknownChannelError = `Unknown notification channel: ${payload.channel}`;
          
          await logger.logFailure(
            payload.channel as NotificationChannel,
            'UNKNOWN_CHANNEL',
            unknownChannelError,
            payload.userId,
            eventType
          );
          
          return {
            success: false,
            error: unknownChannelError,
            channel: payload.channel as NotificationChannel,
          };
      }
    } catch (error: any) {
      console.error(`Error in sendNotification for channel ${payload.channel}:`, error);
      
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
   * Get user profile with notification preferences
   * @param userId The user ID to fetch preferences for
   * @returns The user profile with notification preferences, or null if not found
   */
  private async getUserProfileWithPreferences(userId: string) {
    try {
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('email, phone_number, notification_preferences')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return { profile: null, error: profileError };
      }

      return { profile, error: null };
    } catch (error: any) {
      console.error('Exception fetching user profile:', error);
      return { profile: null, error };
    }
  }

  /**
   * Format message content based on channel
   * @param channel The notification channel
   * @param message The original message
   * @returns Formatted message for the specific channel
   */
  private formatMessageForChannel(
    channel: NotificationChannel,
    message: { title: string; body: string }
  ): { title: string; body: string } {
    switch (channel) {
      case 'sms':
        // SMS should be concise, combine title and body with character limit
        const smsPrefix = message.title ? `${message.title}: ` : '';
        const smsBody = `${smsPrefix}${message.body}`;
        // Truncate if too long (SMS typically has 160 char limit)
        const truncatedSms = smsBody.length > 160
          ? smsBody.substring(0, 157) + '...'
          : smsBody;
        return { title: '', body: truncatedSms };
        
      case 'email':
        // Email can have rich HTML content
        const htmlBody = `
          <h2>${message.title}</h2>
          <p>${message.body.replace(/\n/g, '<br>')}</p>
        `;
        return { title: message.title, body: htmlBody };
        
      case 'in-app':
      default:
        // In-app notifications use the original format
        return { title: message.title, body: message.body };
    }
  }

  /**
   * Send notifications through all enabled channels based on user preferences
   * @param event The notification event
   * @returns A promise that resolves to an array of NotificationResult, one for each channel
   */
  async sendNotificationForEvent(event: NotificationEvent): Promise<NotificationResult[]> {
    // Initialize results array
    const results: NotificationResult[] = [];
    
    // Get logger if available
    const logger = getNotificationLogger(this.supabase);

    try {
      // Log the event attempt
      await logger.logAttempt(
        'in-app', // Use in-app as the default channel for the overall event
        event.userId,
        event.eventType,
        {
          title: event.title,
          eventType: event.eventType,
          metadata: event.metadata
        }
      );
      
      // 1. Get the user's profile with notification preferences (single query)
      const { profile, error: profileError } = await this.getUserProfileWithPreferences(event.userId);

      if (profileError || !profile) {
        const errorMessage = profileError?.message || 'User not found';
        console.error('Error fetching user profile for notifications:', profileError);
        
        // Log the failure
        await logger.logFailure(
          'in-app',
          'USER_NOT_FOUND',
          errorMessage,
          event.userId,
          event.eventType,
          { error: profileError }
        );
        
        return [{
          success: false,
          error: errorMessage,
          channel: 'in-app', // Default to in-app as fallback
        }];
      }

      // 2. Extract notification preferences
      const notificationPreferences = profile.notification_preferences as Record<string, boolean> || {};
      
      // 3. Define channels to attempt
      const channels: NotificationChannel[] = ['sms', 'email', 'in-app'];
      
      // 4. Send notifications through each enabled channel
      // Use Promise.allSettled to ensure all enabled channels are attempted regardless of failures
      const channelPromises = channels.map(async (channel) => {
        try {
          // Check if this channel is enabled for the user
          const channelKey = channel === 'in-app' ? 'in-app' : channel;
          const isEnabled = notificationPreferences[channelKey];

          if (!isEnabled) {
            console.log(`${channel} notifications disabled for user ${event.userId}`);
            
            // No need to log disabled channels as failures
            return {
              success: false,
              error: `${channel} notifications are disabled for this user`,
              channel,
              status: 'disabled',
            };
          }

          // Format message appropriately for this channel
          const formattedMessage = this.formatMessageForChannel(channel, {
            title: event.title,
            body: event.body,
          });

          // Send notification through this channel
          const result = await this.sendNotification({
            userId: event.userId,
            title: formattedMessage.title,
            body: formattedMessage.body,
            channel,
            metadata: {
              ...event.metadata,
              eventType: event.eventType,
            },
          });
          
          return result;
        } catch (channelError: any) {
          console.error(`Error sending ${channel} notification:`, channelError);
          
          // Log the channel-specific error
          await logger.logFailure(
            channel,
            'CHANNEL_ERROR',
            channelError.message || `Unknown error sending ${channel} notification`,
            event.userId,
            event.eventType,
            { error: channelError }
          );
          
          return {
            success: false,
            error: channelError.message || `Unknown error sending ${channel} notification`,
            channel,
          };
        }
      });

      // Wait for all channel attempts to complete
      const channelResults = await Promise.allSettled(channelPromises);
      
      // Process results
      let anySuccess = false;
      
      channelResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          
          // Check if any channel succeeded
          if (result.value.success) {
            anySuccess = true;
          }
        } else {
          console.error('Channel notification promise rejected:', result.reason);
          // Use a valid channel type as fallback
          const errorResult = {
            success: false,
            error: result.reason?.message || 'Unknown error in notification channel',
            channel: 'in-app' as NotificationChannel, // Use in-app as fallback for unknown channel
          };
          
          results.push(errorResult);
          
          // Log the promise rejection
          logger.logFailure(
            'in-app',
            'PROMISE_REJECTION',
            errorResult.error,
            event.userId,
            event.eventType
          );
        }
      });
      
      // Log overall event success/failure
      if (anySuccess) {
        await logger.logSuccess(
          'in-app',
          event.userId,
          event.eventType,
          undefined,
          {
            channels: results.map(r => ({ channel: r.channel, success: r.success })),
            title: event.title
          }
        );
      } else {
        await logger.logFailure(
          'in-app',
          'ALL_CHANNELS_FAILED',
          'All notification channels failed',
          event.userId,
          event.eventType,
          { results }
        );
      }

      return results;
    } catch (error: any) {
      console.error('Error in sendNotificationForEvent:', error);
      
      // Log the overall failure
      await logger.logFailure(
        'in-app',
        'EVENT_ERROR',
        error.message || 'Unknown error sending multi-channel notification',
        event.userId,
        event.eventType,
        { error }
      );
      
      return [{
        success: false,
        error: error.message || 'Unknown error sending multi-channel notification',
        channel: 'in-app', // Default to in-app as fallback
      }];
    }
  }
  
  /**
   * Send a notification to multiple channels
   * @param payload The base notification payload
   * @param channels The channels to send to
   * @returns A promise that resolves to an array of NotificationResult
   */
  async sendMultiChannelNotification(
    payload: Omit<NotificationPayload, 'channel'>,
    channels: NotificationChannel[]
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const logger = getNotificationLogger(this.supabase);
    const eventType = payload.metadata?.eventType;
    
    // Log the multi-channel attempt
    await logger.logAttempt(
      'multi',
      payload.userId,
      eventType,
      {
        channels: channels.join(','),
        title: payload.title
      }
    );
    
    // Try each channel independently, ensuring failures in one don't prevent others
    for (const channel of channels) {
      try {
        const result = await this.sendNotification({
          ...payload,
          channel,
        });
        
        results.push(result);
      } catch (error: any) {
        // If a channel completely fails with an exception, log it but continue with other channels
        console.error(`Exception in channel ${channel} during multi-channel notification:`, error);
        
        await logger.logFailure(
          channel,
          'UNCAUGHT_EXCEPTION',
          error.message || `Uncaught error in ${channel} notification`,
          payload.userId,
          eventType,
          { error: error.stack }
        );
        
        // Add a failure result for this channel
        results.push({
          success: false,
          error: error.message || `Uncaught error in ${channel} notification`,
          channel: channel,
        });
      }
    }
    
    // Log overall success/failure
    const allSucceeded = results.every(r => r.success);
    const someSucceeded = results.some(r => r.success);
    
    if (allSucceeded) {
      await logger.logSuccess(
        'multi',
        payload.userId,
        eventType,
        undefined,
        {
          channels: channels.join(','),
          results: JSON.stringify(results.map(r => ({
            channel: r.channel,
            success: r.success,
            notificationId: r.notificationId
          })))
        }
      );
    } else if (someSucceeded) {
      // Partial success
      await logger.logSuccess(
        'multi',
        payload.userId,
        eventType,
        undefined,
        {
          status: 'PARTIAL_SUCCESS',
          channels: channels.join(','),
          results: JSON.stringify(results.map(r => ({
            channel: r.channel,
            success: r.success,
            error: r.error,
            notificationId: r.notificationId
          })))
        }
      );
    } else {
      // Complete failure
      await logger.logFailure(
        'multi',
        'ALL_CHANNELS_FAILED',
        'All notification channels failed',
        payload.userId,
        eventType,
        {
          channels: channels.join(','),
          results: JSON.stringify(results.map(r => ({
            channel: r.channel,
            error: r.error
          })))
        }
      );
    }
    
    return results;
  }
}

// Create a factory function to get the notification service
export function createNotificationService(
  supabaseClient: ReturnType<typeof createClient<Database>>
): NotificationService {
  return new NotificationService(supabaseClient);
}