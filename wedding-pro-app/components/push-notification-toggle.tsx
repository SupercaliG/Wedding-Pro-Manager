'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';

export function PushNotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    // Check if already subscribed
    if (window.swRegistration) {
      checkSubscriptionStatus();
    } else {
      // Wait for service worker registration
      window.addEventListener('load', () => {
        const checkInterval = setInterval(() => {
          if (window.swRegistration) {
            checkSubscriptionStatus();
            clearInterval(checkInterval);
          }
        }, 500);

        // Clear interval after 5 seconds if registration doesn't happen
        setTimeout(() => clearInterval(checkInterval), 5000);
      });
    }

    // Listen for subscription updates
    window.addEventListener('pushSubscriptionUpdated', (event: any) => {
      setIsSubscribed(!!event.detail.subscription);
      setIsLoading(false);
    });

    return () => {
      window.removeEventListener('pushSubscriptionUpdated', (event: any) => {
        setIsSubscribed(!!event.detail.subscription);
      });
    };
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const subscription = await window.swRegistration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePushNotifications = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        if (typeof window.unsubscribeFromPush === 'function') {
          await window.unsubscribeFromPush();
        }
      } else {
        // Subscribe
        if (Notification.permission !== 'granted') {
          // Request permission
          if (typeof window.requestNotificationPermission === 'function') {
            await window.requestNotificationPermission();
          }
        } else if (typeof window.swRegistration !== 'undefined') {
          // Already have permission, subscribe directly
          const applicationServerKey = urlB64ToUint8Array(
            // Replace with your VAPID public key
            'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
          );
          
          const subscription = await window.swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });
          
          // Store subscription in localStorage for demo purposes
          localStorage.setItem('pushSubscription', JSON.stringify(subscription));
          
          setIsSubscribed(true);
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert base64 to Uint8Array
  const urlB64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff size={16} />
        <span>Push notifications are not supported in this browser</span>
      </div>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={togglePushNotifications}
      disabled={isLoading}
      className="flex items-center gap-2"
    >
      {isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
      {isLoading ? 'Loading...' : isSubscribed ? 'Notifications On' : 'Enable Notifications'}
    </Button>
  );
}

// Add TypeScript declarations for the window object
declare global {
  interface Window {
    swRegistration: ServiceWorkerRegistration;
    requestNotificationPermission: () => Promise<void>;
    unsubscribeFromPush: () => Promise<void>;
  }
}