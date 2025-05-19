import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { NotificationLogger, createNotificationLogger } from './notification-logger';

// Singleton instance of the notification logger
let notificationLoggerInstance: NotificationLogger | null = null;

/**
 * Get a singleton instance of the notification logger
 * @param supabaseClient The Supabase client to use for logging
 * @returns A NotificationLogger instance
 */
export function getNotificationLogger(
  supabaseClient: ReturnType<typeof createClient<Database>>
): NotificationLogger {
  if (!notificationLoggerInstance) {
    notificationLoggerInstance = createNotificationLogger(supabaseClient);
  }
  return notificationLoggerInstance;
}