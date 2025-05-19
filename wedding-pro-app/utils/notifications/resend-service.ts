import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { getNotificationLogger } from './get-notification-logger';
import { NotificationChannel } from './notification-service';

// Define types for our service
export type ResendConfig = {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
};

export type EmailResponse = {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: {
    code?: string | number;
    message: string;
    type?: 'invalid_recipient' | 'rate_limit' | 'authentication' | 'server' | 'network' | 'content' | 'unknown';
  };
};

export class ResendService {
  private client: Resend;
  private defaultFromEmail: string;
  private defaultFromName?: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private supabaseClient?: ReturnType<typeof createClient<Database>>;

  constructor(config: ResendConfig, supabaseClient?: ReturnType<typeof createClient<Database>>) {
    if (!config.apiKey || !config.defaultFromEmail) {
      throw new Error('Missing required Resend configuration');
    }
    
    this.client = new Resend(config.apiKey);
    this.defaultFromEmail = config.defaultFromEmail;
    this.defaultFromName = config.defaultFromName;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Send an email message using Resend
   * @param message The message to send
   * @returns A promise that resolves to an EmailResponse
   */
  async sendEmail(message: EmailMessage, userId?: string, eventType?: string): Promise<EmailResponse> {
    // Get logger if supabase client is available
    const logger = this.supabaseClient ? getNotificationLogger(this.supabaseClient) : null;
    
    if (!message.to || (!message.html && !message.text) || !message.subject) {
      const errorMessage = 'Missing required message parameters: to, subject, and either html or text';
      
      // Log the validation error
      if (logger) {
        await logger.logFailure(
          'email',
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
          type: 'content'
        },
      };
    }
    
    // Validate email address
    if (!ResendService.validateEmail(message.to)) {
      const errorMessage = `Invalid email address format: ${message.to}`;
      
      // Log the validation error
      if (logger) {
        await logger.logFailure(
          'email',
          'INVALID_EMAIL',
          errorMessage,
          userId,
          eventType,
          { emailAddress: message.to }
        );
      }
      
      return {
        success: false,
        error: {
          message: errorMessage,
          type: 'invalid_recipient'
        },
      };
    }
    
    // Log attempt
    if (logger) {
      await logger.logAttempt(
        'email',
        userId,
        eventType,
        {
          emailAddress: message.to,
          subject: message.subject,
          cc: message.cc?.join(','),
          bcc: message.bcc?.join(',')
        }
      );
    }

    try {
      // Attempt to send the message with retries
      const result = await this.sendWithRetry(message);
      
      // Log the result
      if (logger) {
        if (result.success) {
          await logger.logSuccess(
            'email',
            userId,
            eventType,
            result.messageId,
            {
              emailAddress: message.to,
              status: result.status
            }
          );
        } else {
          await logger.logFailure(
            'email',
            result.error?.code?.toString(),
            result.error?.message || 'Unknown email error',
            userId,
            eventType,
            {
              emailAddress: message.to,
              errorType: result.error?.type,
              status: result.status
            }
          );
        }
      }
      
      return result;
    } catch (error: any) {
      console.error('Failed to send email after retries:', error);
      
      // Categorize the error type for better handling
      const errorType = this.categorizeError(error);
      
      // Log the error
      if (logger) {
        await logger.logFailure(
          'email',
          error.statusCode?.toString(),
          error.message || 'Unknown error sending email',
          userId,
          eventType,
          {
            emailAddress: message.to,
            errorType: errorType
          }
        );
      }
      
      return {
        success: false,
        error: {
          code: error.statusCode,
          message: error.message || 'Unknown error sending email',
          type: errorType
        },
      };
    }
  }

  /**
   * Send a message with retry logic for transient failures
   */
  private async sendWithRetry(message: EmailMessage, attempt: number = 1): Promise<EmailResponse> {
    try {
      const from = message.fromName
        ? `${message.fromName} <${message.from || this.defaultFromEmail}>`
        : message.from || this.defaultFromName
          ? `${this.defaultFromName} <${this.defaultFromEmail}>`
          : this.defaultFromEmail;

      // Prepare the email payload
      const emailPayload: any = {
        from,
        to: message.to,
        subject: message.subject,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: message.replyTo,
        attachments: message.attachments,
      };
      
      // Ensure we have at least html content (required by Resend)
      if (message.html) {
        emailPayload.html = message.html;
        if (message.text) {
          emailPayload.text = message.text;
        }
      } else if (message.text) {
        // If only text is provided, use it for html as well
        emailPayload.html = `<div style="white-space: pre-wrap;">${message.text}</div>`;
        emailPayload.text = message.text;
      } else {
        // This shouldn't happen due to the check in sendEmail, but just in case
        emailPayload.html = '<p>No content provided</p>';
      }
      
      const result = await this.client.emails.send(emailPayload);

      return this.processEmailResponse(result);
    } catch (error: any) {
      // If we have retries left and this is a retryable error, try again
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.log(`Retrying email send (${attempt}/${this.maxRetries})...`);
        // Exponential backoff: wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1)));
        return this.sendWithRetry(message, attempt + 1);
      }

      // Otherwise, propagate the error
      throw error;
    }
  }

  /**
   * Process the Resend API response
   */
  private processEmailResponse(result: any): EmailResponse {
    // Check if the email was sent successfully
    if (result.id) {
      return {
        success: true,
        messageId: result.id,
        status: 'sent',
      };
    } else {
      // Categorize the error type based on Resend error codes
      const errorType = this.categorizeResendErrorCode(result.statusCode, result.message);
      
      return {
        success: false,
        error: {
          message: result.message || 'Unknown error',
          code: result.statusCode,
          type: errorType
        },
      };
    }
  }

  /**
   * Categorize Resend error codes into more user-friendly error types
   * @param errorCode The Resend error code
   * @param errorMessage The error message for additional context
   * @returns A categorized error type
   */
  private categorizeResendErrorCode(
    errorCode?: string | number,
    errorMessage?: string
  ): NonNullable<EmailResponse['error']>['type'] {
    if (!errorCode && !errorMessage) return 'unknown';
    
    const code = errorCode?.toString() || '';
    const message = errorMessage?.toLowerCase() || '';
    
    // Invalid recipient errors
    if (code === '400' && (
      message.includes('invalid email') ||
      message.includes('recipient') ||
      message.includes('email address')
    )) {
      return 'invalid_recipient';
    }
    
    // Content errors
    if (code === '400' && (
      message.includes('content') ||
      message.includes('attachment') ||
      message.includes('payload')
    )) {
      return 'content';
    }
    
    // Rate limiting errors
    if (code === '429' || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    
    // Authentication errors
    if (code === '401' || code === '403' || message.includes('auth') || message.includes('permission')) {
      return 'authentication';
    }
    
    // Server errors
    if (code.startsWith('5') || message.includes('server error')) {
      return 'server';
    }
    
    return 'unknown';
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, rate limiting, or server errors
    const retryableCodes = [
      'ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNREFUSED',
      429, 500, 502, 503, 504
    ];

    // Get error type
    const errorType = this.categorizeError(error);
    
    return (
      retryableCodes.includes(error.code) ||
      retryableCodes.includes(error.statusCode) ||
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
  private categorizeError(error: any): NonNullable<EmailResponse['error']>['type'] {
    if (!error) return 'unknown';
    
    // Check for Resend error codes
    if (error.statusCode || error.message) {
      return this.categorizeResendErrorCode(error.statusCode, error.message);
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
    
    // Invalid recipient detection
    if (error.message?.includes('invalid') &&
        (error.message?.includes('recipient') || error.message?.includes('email'))) {
      return 'invalid_recipient';
    }
    
    // Content errors
    if (error.message?.includes('content') ||
        error.message?.includes('attachment') ||
        error.message?.includes('payload')) {
      return 'content';
    }
    
    return 'unknown';
  }

  /**
   * Validate an email address to ensure it's in a valid format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Create a ResendService instance using environment variables
 * @param supabaseClient Optional Supabase client for logging
 */
export function createResendService(
  supabaseClient?: ReturnType<typeof createClient<Database>>
): ResendService {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFromEmail = process.env.RESEND_FROM_EMAIL;
  const defaultFromName = process.env.RESEND_FROM_NAME;

  if (!apiKey || !defaultFromEmail) {
    throw new Error('Missing required Resend environment variables');
  }

  return new ResendService({
    apiKey,
    defaultFromEmail,
    defaultFromName,
  }, supabaseClient);
}

// Export a singleton instance for use throughout the application
let resendServiceInstance: ResendService | null = null;
let supabaseClientForSingleton: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Get a singleton instance of the ResendService
 * @param supabaseClient Optional Supabase client for logging
 * @returns A ResendService instance
 */
export function getResendService(
  supabaseClient?: ReturnType<typeof createClient<Database>>
): ResendService {
  // If we already have an instance but with a different supabase client, recreate it
  if (supabaseClient && supabaseClient !== supabaseClientForSingleton) {
    resendServiceInstance = null;
  }
  
  if (!resendServiceInstance) {
    resendServiceInstance = createResendService(supabaseClient);
    supabaseClientForSingleton = supabaseClient;
  }
  return resendServiceInstance;
}