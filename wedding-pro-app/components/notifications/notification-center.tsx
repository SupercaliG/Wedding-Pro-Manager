'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationList } from './notification-list';
import { Database } from '@/types/supabase';
import { fetchUserNotifications, getUnreadNotificationCount } from '@/app/notification-center-actions';
import { createClient } from '@/utils/supabase/client';
import { usePathname } from 'next/navigation';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface NotificationCenterProps {
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

export function NotificationCenter({ 
  initialNotifications, 
  initialUnreadCount 
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Set up Supabase realtime subscription for new notifications
  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to new notifications
    const subscription = supabase
      .channel('notification-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'channel=eq.in-app',
        },
        (payload) => {
          // Add the new notification to the list
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          
          // Update unread count
          if (!newNotification.read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: 'channel=eq.in-app',
        },
        (payload) => {
          // Update the notification in the list
          const updatedNotification = payload.new as Notification;
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === updatedNotification.id 
                ? updatedNotification 
                : notification
            )
          );
          
          // Update unread count if read status changed
          if (payload.old.read !== updatedNotification.read) {
            setUnreadCount(prev => 
              updatedNotification.read ? Math.max(0, prev - 1) : prev + 1
            );
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Refresh notifications when opening the dropdown
  const handleToggleDropdown = async () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    if (newState) {
      // Fetch fresh notifications when opening
      try {
        const freshNotifications = await fetchUserNotifications();
        setNotifications(freshNotifications);
        
        // Update unread count
        const count = await getUnreadNotificationCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Error refreshing notifications:', error);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleToggleDropdown}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 z-50">
          <NotificationList 
            initialNotifications={notifications} 
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}