'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Get the current notification preferences for the user
 * @returns The notification preferences object or null if not found
 */
export async function getUserNotificationPreferences() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('Error fetching notification preferences:', error);
    return null;
  }
  
  return profile.notification_preferences;
}

/**
 * Update notification preferences for the current user
 * @param preferences Object containing preferences for each channel
 * @returns True if successful, false otherwise
 */
export async function updateNotificationPreferences(preferences: {
  sms?: boolean;
  email?: boolean;
  'in-app'?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }
  
  // Get current preferences first
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .single();
  
  if (fetchError) {
    console.error('Error fetching current notification preferences:', fetchError);
    return false;
  }
  
  // Merge current preferences with new ones
  const currentPreferences = profile.notification_preferences as Record<string, boolean>;
  const updatedPreferences = {
    ...currentPreferences,
    ...preferences
  };
  
  // Update the preferences in the database
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      notification_preferences: updatedPreferences
    })
    .eq('id', user.id);
  
  if (updateError) {
    console.error('Error updating notification preferences:', updateError);
    return false;
  }
  
  // Revalidate relevant paths to refresh UI
  revalidatePath('/dashboard/profile');
  
  return true;
}