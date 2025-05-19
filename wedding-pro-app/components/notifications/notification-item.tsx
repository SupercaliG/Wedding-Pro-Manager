'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Database } from '@/types/supabase';
import { markNotificationAsRead } from '@/app/notification-center-actions';
import { Bell, Check } from 'lucide-react';

type Notification = Database['public']['Tables']['notifications']['Row'];

export interface NotificationItemProps {
  notification: Notification;
  onStatusChange?: (updatedNotification: Notification) => void;
}

export function NotificationItem({ notification, onStatusChange }: NotificationItemProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleMarkAsRead = async () => {
    if (notification.read) return;
    
    setIsLoading(true);
    try {
      await markNotificationAsRead(notification.id);
      
      // Update the notification in the parent component
      if (onStatusChange) {
        onStatusChange({
          ...notification,
          read: true
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div 
      className={`p-4 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50' : ''}`}
      onClick={handleMarkAsRead}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          <div className={`p-2 rounded-full ${!notification.read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <Bell className="h-4 w-4" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {notification.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {notification.content}
          </p>
          <div className="mt-2 flex items-center text-xs text-gray-500">
            <span>
              {notification.created_at ? (
                formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
              ) : ''}
            </span>
            
            {!notification.read ? (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                New
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center text-green-600">
                <Check className="h-3 w-3 mr-1" />
                Read
              </span>
            )}
          </div>
        </div>
        
        {!notification.read && (
          <button
            className="ml-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsRead();
            }}
            disabled={isLoading}
            aria-label="Mark as read"
          >
            <Check className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
}