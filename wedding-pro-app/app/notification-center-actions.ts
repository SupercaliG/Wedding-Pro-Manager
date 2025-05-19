'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Fetch notifications for the current user
 * @param limit Maximum number of notifications to fetch
 * @param offset Offset for pagination
 * @returns Array of notifications
 */
export async function fetchUserNotifications(limit = 10, offset = 0) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }
  
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('channel', 'in-app')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  
  return notifications || [];
}

/**
 * Get the count of unread notifications for the current user
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return 0;
  }
  
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('channel', 'in-app')
    .eq('read', false);
  
  if (error) {
    console.error('Error counting unread notifications:', error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Mark a specific notification as read
 * @param notificationId ID of the notification to mark as read
 * @returns True if successful, false otherwise
 */
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }
  
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/notifications');
  
  return true;
}

/**
 * Mark all notifications for the current user as read
 * @returns True if successful, false otherwise
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }
  
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('channel', 'in-app')
    .eq('read', false);
  
  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
  
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/notifications');
  
  return true;
}