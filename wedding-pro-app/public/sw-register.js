// Service Worker Registration Script

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Set up periodic sync if supported
        if ('periodicSync' in registration) {
          const status = navigator.permissions.query({
            name: 'periodic-background-sync',
          }).then((status) => {
            if (status.state === 'granted') {
              registration.periodicSync.register('content-sync', {
                minInterval: 24 * 60 * 60 * 1000, // 1 day
              });
            }
          });
        }
        
        // Initialize push notification subscription
        initializePushNotifications(registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Function to initialize push notifications
function initializePushNotifications(registration) {
  // Store the registration object for later use
  window.swRegistration = registration;
  
  // Check if push notifications are supported
  if (!('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser');
    return;
  }
  
  // Check notification permission status
  checkNotificationPermission();
}

// Function to check notification permission
function checkNotificationPermission() {
  if (Notification.permission === 'denied') {
    console.warn('Notifications are denied by the user');
    return;
  }
  
  // If permission is already granted, subscribe
  if (Notification.permission === 'granted') {
    subscribeUserToPush();
    return;
  }
  
  // Otherwise, we need to ask for permission when appropriate
  // This should be triggered by user interaction, not automatically
  // We'll expose a function that can be called from a button click
  window.requestNotificationPermission = () => {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        subscribeUserToPush();
      }
    });
  };
}

// Function to subscribe user to push notifications
function subscribeUserToPush() {
  const applicationServerKey = urlB64ToUint8Array(
    // Replace with your VAPID public key
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
  );
  
  window.swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  })
  .then((subscription) => {
    console.log('User is subscribed to push notifications');
    
    // Send the subscription to your server
    // This is where you would typically send the subscription to your backend
    // saveSubscription(subscription);
    
    // Store subscription in localStorage for demo purposes
    localStorage.setItem('pushSubscription', JSON.stringify(subscription));
    
    // Dispatch an event that the UI can listen for
    window.dispatchEvent(new CustomEvent('pushSubscriptionUpdated', {
      detail: { subscription }
    }));
  })
  .catch((error) => {
    console.error('Failed to subscribe user to push notifications:', error);
  });
}

// Helper function to convert base64 to Uint8Array
// (required for the applicationServerKey)
function urlB64ToUint8Array(base64String) {
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
}

// Expose a function to unsubscribe from push notifications
window.unsubscribeFromPush = () => {
  if (!window.swRegistration) return Promise.reject('No service worker registration');
  
  return window.swRegistration.pushManager.getSubscription()
    .then((subscription) => {
      if (!subscription) {
        return;
      }
      
      // Remove subscription from server
      // This is where you would typically remove the subscription from your backend
      // deleteSubscription(subscription);
      
      // Remove from localStorage
      localStorage.removeItem('pushSubscription');
      
      // Unsubscribe
      return subscription.unsubscribe();
    })
    .then(() => {
      console.log('User is unsubscribed from push notifications');
      
      // Dispatch an event that the UI can listen for
      window.dispatchEvent(new CustomEvent('pushSubscriptionUpdated', {
        detail: { subscription: null }
      }));
    });
};