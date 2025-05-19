import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { NotificationChannel } from './notification-service';

/**
 * Log levels for notification events
 */
export type LogLevel = 'info' | 'warning' | 'error';

/**
 * Structure for notification log entries
 */
export interface NotificationLogEntry {
  timestamp: string;
  userId?: string;
  eventType?: string;
  channel: NotificationChannel;
  status: 'success' | 'failure' | 'attempt';
  message: string;
  errorCode?: string | number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Notification Logger - Handles logging of notification events
 */
export class NotificationLogger {
  private supabase: ReturnType<typeof createClient<Database>>;
  private enableConsoleLogging: boolean = true;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Log a notification event
   * 
   * @param entry The log entry to record
   */
  async log(entry: NotificationLogEntry): Promise<void> {
    try {
      // Always log to console for debugging
      if (this.enableConsoleLogging) {
        this.logToConsole(entry);
      }

      // Log to Supabase notification_logs table
      await this.logToDatabase(entry);
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to log notification event to database:', error);
      console.error('Original log entry:', entry);
    }
  }

  /**
   * Log a notification attempt
   */
  async logAttempt(
    channel: NotificationChannel,
    userId?: string,
    eventType?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      userId,
      eventType,
      channel,
      status: 'attempt',
      message: `Attempting to send ${channel} notification${userId ? ' to user ' + userId : ''}`,
      metadata
    });
  }

  /**
   * Log a notification success
   */
  async logSuccess(
    channel: NotificationChannel,
    userId?: string,
    eventType?: string,
    notificationId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      userId,
      eventType,
      channel,
      status: 'success',
      message: `Successfully sent ${channel} notification${userId ? ' to user ' + userId : ''}`,
      metadata: {
        ...metadata,
        notificationId
      }
    });
  }

  /**
   * Log a notification failure
   */
  async logFailure(
    channel: NotificationChannel,
    errorCode: string | number | undefined,
    errorMessage: string,
    userId?: string,
    eventType?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      userId,
      eventType,
      channel,
      status: 'failure',
      message: `Failed to send ${channel} notification${userId ? ' to user ' + userId : ''}`,
      errorCode,
      errorMessage,
      metadata
    });
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: NotificationLogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const prefix = `[NOTIFICATION][${entry.channel.toUpperCase()}][${entry.status.toUpperCase()}]`;
    
    switch (entry.status) {
      case 'success':
        console.log(`${prefix} ${timestamp} - ${entry.message}`);
        break;
      case 'failure':
        console.error(
          `${prefix} ${timestamp} - ${entry.message}\nError: ${entry.errorCode ? `[${entry.errorCode}] ` : ''}${entry.errorMessage}`
        );
        break;
      case 'attempt':
        console.info(`${prefix} ${timestamp} - ${entry.message}`);
        break;
    }
  }

  /**
   * Log to Supabase notification_logs table
   */
  private async logToDatabase(entry: NotificationLogEntry): Promise<void> {
    await this.supabase.from('notification_logs').insert({
      user_id: entry.userId,
      event_type: entry.eventType,
      channel: entry.channel,
      status: entry.status,
      message: entry.message,
      error_code: entry.errorCode?.toString(),
      error_message: entry.errorMessage,
      metadata: entry.metadata
    });
  }
}

/**
 * Create a notification logger instance
 */
export function createNotificationLogger(
  supabaseClient: ReturnType<typeof createClient<Database>>
): NotificationLogger {
  return new NotificationLogger(supabaseClient);
}