# PWA Implementation for Wedding Pro

This document outlines the Progressive Web App (PWA) implementation for the Wedding Pro application.

## Overview

The Wedding Pro application has been enhanced with Progressive Web App (PWA) capabilities, allowing it to:

1. Be installable on user devices
2. Work offline or with poor connectivity
3. Send push notifications
4. Provide a more app-like experience

## Implementation Details

### 1. Web App Manifest

The web app manifest (`public/manifest.json`) provides metadata about the application, enabling it to be installed on user devices. Key properties include:

- `name`: The full name of the application
- `short_name`: A shorter name used on the home screen
- `icons`: Various sized icons for different devices and contexts
- `start_url`: The URL that loads when the app is launched
- `display`: How the app should be displayed (standalone, fullscreen, etc.)
- `background_color`: The background color of the splash screen
- `theme_color`: The theme color for the browser UI

### 2. Service Worker

The service worker (`public/sw.js`) enables offline functionality and background processing:

- **Installation**: Caches critical assets during installation
- **Activation**: Cleans up old caches when a new version is activated
- **Fetch Handling**: Serves resources from the cache when offline, falling back to network when online
- **Offline Page**: Provides a dedicated offline experience when the user has no connectivity
- **Push Notifications**: Handles incoming push notifications and displays them to the user

### 3. Service Worker Registration

The service worker registration script (`public/sw-register.js`) handles:

- Registering the service worker with the browser
- Setting up push notification subscriptions
- Managing notification permissions
- Handling periodic background sync (where supported)

### 4. Push Notification UI

The `PushNotificationToggle` component provides a user interface for:

- Requesting notification permission
- Subscribing to push notifications
- Unsubscribing from push notifications
- Displaying the current subscription status

## Testing

The PWA implementation can be tested using:

1. **Lighthouse**: Run Lighthouse in Chrome DevTools to check PWA compliance
2. **Application Tab**: Use the Application tab in Chrome DevTools to inspect:
   - Service Worker status
   - Manifest details
   - Cache storage
3. **Network Conditions**: Test offline functionality by disabling network in DevTools
4. **Unit Tests**: Run the PWA tests with `npm test tests/pwa.test.ts`

## Manual Testing Checklist

- [ ] Verify the app can be installed via the browser's install prompt
- [ ] Confirm the app works offline after initial load
- [ ] Test that push notification permission can be requested
- [ ] Verify push notifications can be received when the app is in the background
- [ ] Check that the offline page is displayed when navigating while offline
- [ ] Ensure cached assets are properly updated when a new version is deployed

## Future Enhancements

Potential improvements to the PWA implementation:

1. **Background Sync**: Implement background sync for offline form submissions
2. **Periodic Sync**: Use periodic background sync for regular data updates
3. **Share Target**: Add share target capabilities to receive shared content
4. **Badging API**: Implement the Badging API for notification counts
5. **Advanced Caching Strategies**: Implement more sophisticated caching strategies using Workbox

## Resources

- [MDN PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google PWA Guide](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Next.js PWA Documentation](https://github.com/shadowwalker/next-pwa)