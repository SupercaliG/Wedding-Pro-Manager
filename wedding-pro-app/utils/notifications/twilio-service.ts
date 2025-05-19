import { Twilio } from 'twilio';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { getNotificationLogger } from './get-notification-logger';
import { NotificationChannel } from './notification-service';

// Define types for our service
export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export type SMSMessage = {
  to: string;
  body: string;
  messageId?: string;
};

export type SMSResponse = {
  success: boolean;
  messageId?: string;
  sid?: string;
  status?: string;
  error?: {
    code?: string | number;
    message: string;
    type?: 'invalid_number' | 'rate_limit' | 'authentication' | 'server' | 'network' | 'unknown';
  };
};

export class TwilioService {
  private client: Twilio;
  private fromNumber: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private supabaseClient?: ReturnType<typeof createClient<Database>>;

  constructor(config: TwilioConfig, supabaseClient?: ReturnType<typeof createClient<Database>>) {
    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      throw new Error('Missing required Twilio configuration');
    }
    
    this.client = new Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Send an SMS message using Twilio
   * @param message The message to send
   * @returns A promise that resolves to an SMSResponse
   */
  async sendSMS(message: SMSMessage, userId?: string, eventType?: string): Promise<SMSResponse> {
    // Get logger if supabase client is available
    const logger = this.supabaseClient ? getNotificationLogger(this.supabaseClient) : null;
    
    if (!message.to || !message.body) {
      const errorMessage = 'Missing required message parameters: to and body';
      
      // Log the validation error
      if (logger) {
        await logger.logFailure(
          'sms',
          'VALIDATION_ERROR',
          errorMessage,
          userId,
          eventType
        );
      }
      
      return {
        success: false,
        error: {
          message: errorMessage,
          type: 'invalid_number'
        },
      };
    }

    // Format phone number if needed (ensure it has +1 for US numbers)
    const formattedTo = this.formatPhoneNumber(message.to);
    
    // Log attempt
    if (logger) {
      await logger.logAttempt(
        'sms',
        userId,
        eventType,
        { phoneNumber: formattedTo }
      );
    }

    try {
      // Validate phone number before attempting to send
      if (!TwilioService.validatePhoneNumber(formattedTo)) {
        const errorMessage = `Invalid phone number format: ${formattedTo}`;
        
        // Log the validation error
        if (logger) {
          await logger.logFailure(
            'sms',
            'INVALID_PHONE_NUMBER',
            errorMessage,
            userId,
            eventType,
            { phoneNumber: formattedTo }
          );
        }
        
        return {
          success: false,
          error: {
            message: errorMessage,
            type: 'invalid_number'
          },
        };
      }
      
      // Attempt to send the message with retries
      const result = await this.sendWithRetry(formattedTo, message.body);
      
      // Log the result
      if (logger) {
        if (result.success) {
          await logger.logSuccess(
            'sms',
            userId,
            eventType,
            result.messageId,
            {
              phoneNumber: formattedTo,
              status: result.status,
              sid: result.sid
            }
          );
        } else {
          await logger.logFailure(
            'sms',
            result.error?.code,
            result.error?.message || 'Unknown SMS error',
            userId,
            eventType,
            {
              phoneNumber: formattedTo,
              errorType: result.error?.type,
              status: result.status
            }
          );
        }
      }
      
      return result;
    } catch (error: any) {
      console.error('Failed to send SMS after retries:', error);
      
      // Categorize the error type for better handling
      const errorType = this.categorizeError(error);
      
      // Log the error
      if (logger) {
        await logger.logFailure(
          'sms',
          error.code,
          error.message || 'Unknown error sending SMS',
          userId,
          eventType,
          {
            phoneNumber: formattedTo,
            errorType: errorType
          }
        );
      }
      
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message || 'Unknown error sending SMS',
          type: errorType
        },
      };
    }
  }

  /**
   * Send a message with retry logic for transient failures
   */
  private async sendWithRetry(to: string, body: string, attempt: number = 1): Promise<SMSResponse> {
    try {
      const result = await this.client.messages.create({
        body,
        from: this.fromNumber,
        to,
      });

      return this.processMessageResponse(result);
    } catch (error) {
      // If we have retries left and this is a retryable error, try again
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.log(`Retrying SMS send (${attempt}/${this.maxRetries})...`);
        // Exponential backoff: wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1)));
        return this.sendWithRetry(to, body, attempt + 1);
      }

      // Otherwise, propagate the error
      throw error;
    }
  }

  /**
   * Process the Twilio message response
   */
  private processMessageResponse(result: MessageInstance): SMSResponse {
    // Check if the message was sent successfully
    const isSuccessful = ['queued', 'sending', 'sent', 'delivered'].includes(result.status);

    if (isSuccessful) {
      return {
        success: true,
        messageId: result.sid,
        sid: result.sid,
        status: result.status,
      };
    } else {
      // Categorize the error type based on Twilio error codes
      const errorType = this.categorizeTwilioErrorCode(result.errorCode);
      
      return {
        success: false,
        messageId: result.sid,
        sid: result.sid,
        status: result.status,
        error: {
          code: result.errorCode,
          message: result.errorMessage || 'Unknown error',
          type: errorType
        },
      };
    }
  }

  /**
   * Categorize Twilio error codes into more user-friendly error types
   * @param errorCode The Twilio error code
   * @returns A categorized error type
   */
  private categorizeTwilioErrorCode(errorCode?: string | number): NonNullable<SMSResponse['error']>['type'] {
    if (!errorCode) return 'unknown';
    
    const code = errorCode.toString();
    
    // Invalid phone number errors
    if (['21211', '21214', '21219', '21401', '21407', '21610', '21612', '21614'].includes(code)) {
      return 'invalid_number';
    }
    
    // Rate limiting errors
    if (['20429', '20003', '20429'].includes(code) || code.startsWith('429')) {
      return 'rate_limit';
    }
    
    // Authentication errors
    if (['20003', '20004', '20005', '20006', '20008'].includes(code)) {
      return 'authentication';
    }
    
    // Server errors
    if (code.startsWith('5') || ['30001', '30002', '30003', '30004', '30005', '30006', '30007', '30008'].includes(code)) {
      return 'server';
    }
    
    // Network errors
    if (['30009', '30010'].includes(code)) {
      return 'network';
    }
    
    return 'unknown';
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, rate limiting, or Twilio server errors
    const retryableCodes = [
      'ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNREFUSED',
      '429', '500', '502', '503', '504'
    ];

    // Get error type
    const errorType = this.categorizeError(error);
    
    return (
      retryableCodes.includes(error.code) ||
      (error.status && error.status >= 500) ||
      error.message?.includes('timeout') ||
      error.message?.includes('rate limit') ||
      errorType === 'network' ||
      errorType === 'server' ||
      errorType === 'rate_limit'
    );
  }
  
  /**
   * Categorize general errors into specific types
   * @param error The error object
   * @returns A categorized error type
   */
  private categorizeError(error: any): NonNullable<SMSResponse['error']>['type'] {
    if (!error) return 'unknown';
    
    // Check for Twilio error codes
    if (error.code && typeof error.code === 'string' && error.code.match(/^[0-9]+$/)) {
      return this.categorizeTwilioErrorCode(error.code);
    }
    
    // Network errors
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH'];
    if (networkErrors.includes(error.code)) {
      return 'network';
    }
    
    // Rate limiting
    if (error.status === 429 || error.code === 429 || error.message?.includes('rate limit')) {
      return 'rate_limit';
    }
    
    // Authentication errors
    if (error.status === 401 || error.status === 403 ||
        error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
      return 'authentication';
    }
    
    // Server errors
    if ((error.status && error.status >= 500) || error.message?.includes('server error')) {
      return 'server';
    }
    
    // Invalid number detection
    if (error.message?.includes('invalid') && error.message?.includes('number')) {
      return 'invalid_number';
    }
    
    return 'unknown';
  }

  /**
   * Format a phone number to ensure it has the correct format for Twilio
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // If it's a 10-digit US number without country code, add +1
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }

    // If it already has a country code (11+ digits), ensure it has a +
    if (digitsOnly.length >= 11) {
      return digitsOnly.startsWith('+') ? phoneNumber : `+${digitsOnly}`;
    }

    // Return as-is if it doesn't match expected patterns
    return phoneNumber;
  }

  /**
   * Validate a phone number to ensure it's in a valid format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Basic validation - can be enhanced based on requirements
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\D/g, ''));
  }
  
  /**
   * Check the status of a sent message
   * @param messageSid The Twilio message SID
   * @returns The current status of the message
   */
  async checkMessageStatus(messageSid: string): Promise<string> {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return message.status;
    } catch (error: any) {
      console.error(`Error checking message status for ${messageSid}:`, error);
      throw error;
    }
  }
}

/**
 * Create a TwilioService instance using environment variables
 * @param supabaseClient Optional Supabase client for logging
 */
export function createTwilioService(
  supabaseClient?: ReturnType<typeof createClient<Database>>
): TwilioService {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Missing required Twilio environment variables');
  }

  return new TwilioService({
    accountSid,
    authToken,
    fromNumber,
  }, supabaseClient);
}

// Export a singleton instance for use throughout the application
let twilioServiceInstance: TwilioService | null = null;
let supabaseClientForSingleton: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Get a singleton instance of the TwilioService
 * @param supabaseClient Optional Supabase client for logging
 * @returns A TwilioService instance
 */
export function getTwilioService(
  supabaseClient?: ReturnType<typeof createClient<Database>>
): TwilioService {
  // If we already have an instance but with a different supabase client, recreate it
  if (supabaseClient && supabaseClient !== supabaseClientForSingleton) {
    twilioServiceInstance = null;
  }
  
  if (!twilioServiceInstance) {
    twilioServiceInstance = createTwilioService(supabaseClient);
    supabaseClientForSingleton = supabaseClient;
  }
  return twilioServiceInstance;
}