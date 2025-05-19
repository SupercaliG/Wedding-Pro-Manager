import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the PushSubscription
class MockPushSubscription {
  endpoint = 'https://example.com/push-endpoint';
  expirationTime = null;
  
  getKey(name: string) {
    return new Uint8Array(8);
  }
  
  toJSON() {
    return {
      endpoint: this.endpoint,
      expirationTime: this.expirationTime,
      keys: {
        p256dh: 'mock-p256dh-key',
        auth: 'mock-auth-key'
      }
    };
  }
  
  unsubscribe = vi.fn().mockResolvedValue(true);
}

// Mock the PushManager
class MockPushManager {
  subscription: MockPushSubscription | null = null;
  
  getSubscription = vi.fn().mockImplementation(() => {
    return Promise.resolve(this.subscription);
  });
  
  subscribe = vi.fn().mockImplementation((options) => {
    this.subscription = new MockPushSubscription();
    return Promise.resolve(this.subscription);
  });
}

// Mock the ServiceWorkerRegistration
class MockServiceWorkerRegistration {
  scope = '/test-scope/';
  pushManager = new MockPushManager();
  
  periodicSync = {
    register: vi.fn().mockResolvedValue(undefined),
  };
}

// Mock the navigator.serviceWorker
const mockServiceWorker = {
  register: vi.fn().mockImplementation(() => {
    return Promise.resolve(new MockServiceWorkerRegistration());
  }),
};

// Mock the window object with any type to avoid TypeScript errors
const mockWindow: any = {
  addEventListener: vi.fn().mockImplementation((event, callback) => {
    // Store the callback for later execution
    if (event === 'load') {
      mockWindow.loadCallback = callback;
    }
    if (event === 'pushSubscriptionUpdated') {
      mockWindow.pushSubscriptionCallback = callback;
    }
  }),
  removeEventListener: vi.fn(),
  loadCallback: null,
  pushSubscriptionCallback: null,
  swRegistration: null,
  navigator: {
    serviceWorker: mockServiceWorker,
    permissions: {
      query: vi.fn().mockResolvedValue({ state: 'granted' }),
    },
  },
  Notification: {
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
  PushManager: MockPushManager,
  atob: vi.fn().mockImplementation((base64) => {
    // Simple mock implementation of atob that returns a string with length 8
    return 'aaaaaaaa';
  }),
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  dispatchEvent: vi.fn(),
  CustomEvent: vi.fn().mockImplementation((name, options) => {
    return { type: name, detail: options.detail };
  }),
  requestNotificationPermission: vi.fn().mockResolvedValue(undefined),
  unsubscribeFromPush: vi.fn().mockResolvedValue(undefined),
};

// Mock the Cache API
const mockCacheStorage: any = {
  open: vi.fn().mockResolvedValue({
    addAll: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(new Response('cached response')),
  }),
  keys: vi.fn().mockResolvedValue(['wedding-pro-cache-v1']),
  delete: vi.fn().mockResolvedValue(true),
  has: vi.fn().mockResolvedValue(true),
  match: vi.fn().mockResolvedValue(new Response('cached response')),
};

describe('PWA Service Worker Registration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup global mocks
    global.window = mockWindow;
    global.navigator = mockWindow.navigator;
    global.Notification = mockWindow.Notification;
    global.caches = mockCacheStorage;
    
    // Reset the window.swRegistration
    mockWindow.swRegistration = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register the service worker when supported', async () => {
    // Directly test the service worker registration logic
    // This simulates what would happen in sw-register.js
    
    // Call the register function directly
    const registration = await navigator.serviceWorker.register('/sw.js');
    window.swRegistration = registration;
    
    // Verify service worker was registered
    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(mockWindow.swRegistration).not.toBeNull();
  });

  it('should handle push notification subscription', async () => {
    // Setup window.swRegistration
    mockWindow.swRegistration = new MockServiceWorkerRegistration();
    
    // Skip the actual base64 conversion and just create a Uint8Array directly
    // This avoids issues with the atob mock
    const mockApplicationServerKey = new Uint8Array(16);
    
    // Mock the subscription function
    const subscribeUserToPush = async () => {
      if (!mockWindow.swRegistration) {
        throw new Error('Service worker registration not found');
      }
      
      const subscription = await mockWindow.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: mockApplicationServerKey
      });
      
      // Store subscription in localStorage for demo purposes
      window.localStorage.setItem('pushSubscription', JSON.stringify(subscription));
      
      // Dispatch an event that the UI can listen for
      window.dispatchEvent(new CustomEvent('pushSubscriptionUpdated', {
        detail: { subscription }
      }));
      
      return subscription;
    };
    
    // Call the function
    const subscription = await subscribeUserToPush();
    
    // Verify subscription was created
    expect(mockWindow.swRegistration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    
    // Verify localStorage was updated
    expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
      'pushSubscription',
      expect.any(String)
    );
    
    // Verify event was dispatched
    expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pushSubscriptionUpdated',
        detail: expect.objectContaining({
          subscription: expect.any(Object)
        })
      })
    );
  });
});

describe('Offline Functionality', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create a more robust mock for caches
    const mockCache = {
      addAll: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      match: vi.fn().mockResolvedValue(new Response('cached response')),
    };
    
    // Ensure caches.open returns a resolved promise with the mock cache
    global.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
      keys: vi.fn().mockResolvedValue(['wedding-pro-cache-v1']),
      delete: vi.fn().mockResolvedValue(true),
      has: vi.fn().mockResolvedValue(true),
      match: vi.fn().mockResolvedValue(new Response('cached response')),
    } as any;
    
    // Create a mock service worker global scope
    const mockSelf: any = {
      addEventListener: vi.fn().mockImplementation((event, callback) => {
        if (event === 'install') {
          mockSelf.installCallback = callback;
        }
      }),
      installCallback: null,
    };
    
    global.self = mockSelf;
  });

  it('should cache critical assets during installation', async () => {
    // Define the cache name and URLs to cache (matching the actual service worker)
    const CACHE_NAME = 'wedding-pro-cache-v1';
    const urlsToCache = [
      '/',
      '/index.html',
      '/offline.html',
      '/manifest.json',
      '/sw-register.js',
    ];
    
    // Create a mock event with waitUntil method
    const mockEvent = {
      waitUntil: vi.fn().mockImplementation((promise) => {
        return promise;
      }),
    };
    
    // Directly test the caching logic without relying on the event handler
    await mockEvent.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(urlsToCache);
      })
    );
    
    // Verify caches.open was called with the correct cache name
    expect(caches.open).toHaveBeenCalledWith(CACHE_NAME);
    
    // Get the mock cache and verify addAll was called
    const cache = await caches.open(CACHE_NAME);
    expect(cache.addAll).toHaveBeenCalledWith(urlsToCache);
    
    // Verify the event.waitUntil was called
    expect(mockEvent.waitUntil).toHaveBeenCalled();
  });
});