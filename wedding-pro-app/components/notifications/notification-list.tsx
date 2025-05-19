'use client';

import { useState, useEffect } from 'react';
import { Database } from '@/types/supabase';
import { NotificationItem } from './notification-item';
import { Button } from '@/components/ui/button';
import { markAllNotificationsAsRead } from '@/app/notification-center-actions';
import Link from 'next/link';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface NotificationListProps {
  initialNotifications: Notification[];
  onClose?: () => void;
}

export function NotificationList({ 
  initialNotifications,
  onClose 
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    try {
      await markAllNotificationsAsRead();
      // Update local state to mark all as read
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          read: true
        }))
      );
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-lg">Notifications</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarkAllAsRead}
            disabled={isLoading || notifications.every(n => n.read)}
          >
            Mark all read
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
      
      <div className="overflow-y-auto flex-grow">
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification}
                onStatusChange={(updatedNotification) => {
                  setNotifications(prev => 
                    prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No notifications to display
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
        <Link 
          href="/dashboard/notifications" 
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={onClose}
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}