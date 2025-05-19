'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getUserNotificationPreferences, updateNotificationPreferences } from '@/app/notification-preference-actions';

type NotificationPreferences = {
  sms: boolean;
  email: boolean;
  'in-app': boolean;
};

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    sms: true,
    email: true,
    'in-app': true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const userPreferences = await getUserNotificationPreferences();
        if (userPreferences) {
          setPreferences(userPreferences as NotificationPreferences);
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        alert('Error: Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, []);

  const handleToggle = (channel: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateNotificationPreferences(preferences);
      if (success) {
        alert('Notification preferences updated successfully');
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert('Error: Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-4">Loading notification preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications" className="text-base">Email Notifications</Label>
            <p className="text-sm text-gray-500">
              Receive notifications via email
            </p>
          </div>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors"
               onClick={() => handleToggle('email')}
               style={{ backgroundColor: preferences.email ? '#3b82f6' : '#e5e7eb', cursor: 'pointer' }}>
            <span className="sr-only">Toggle email notifications</span>
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
              style={{ transform: preferences.email ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sms-notifications" className="text-base">SMS Notifications</Label>
            <p className="text-sm text-gray-500">
              Receive notifications via text message
            </p>
          </div>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors"
               onClick={() => handleToggle('sms')}
               style={{ backgroundColor: preferences.sms ? '#3b82f6' : '#e5e7eb', cursor: 'pointer' }}>
            <span className="sr-only">Toggle SMS notifications</span>
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
              style={{ transform: preferences.sms ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="in-app-notifications" className="text-base">In-App Notifications</Label>
            <p className="text-sm text-gray-500">
              Receive notifications within the application
            </p>
          </div>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors"
               onClick={() => handleToggle('in-app')}
               style={{ backgroundColor: preferences['in-app'] ? '#3b82f6' : '#e5e7eb', cursor: 'pointer' }}>
            <span className="sr-only">Toggle in-app notifications</span>
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
              style={{ transform: preferences['in-app'] ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
            />
          </div>
        </div>
      </div>

      <Button 
        onClick={handleSave} 
        disabled={saving}
        className="w-full sm:w-auto"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
}