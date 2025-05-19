# Cross-Functional Testing

This document outlines the cross-functional testing strategy for the encrypted messaging system in the Wedding Pro application, focusing on testing across different network conditions and device types.

## Network Condition Testing

### 1. Flaky Connection Simulation

Testing the application's behavior under unreliable network conditions is crucial for ensuring a good user experience in real-world scenarios.

#### Test Cases
- Message queuing during intermittent connectivity
- Message delivery after reconnection
- Synchronization of missed messages
- Recovery time after connection loss

#### Implementation

```typescript
import { test, expect } from '@playwright/test';

test.describe('Flaky Connection Tests', () => {
  test('should queue messages when offline and send when reconnected', async ({ page }) => {
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Open a conversation
    await page.click('text=John Doe');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Try to send messages while offline
    await page.fill('textarea[placeholder="Type a message..."]', 'Offline message 1');
    await page.click('button[aria-label="Send message"]');
    
    await page.fill('textarea[placeholder="Type a message..."]', 'Offline message 2');
    await page.click('button[aria-label="Send message"]');
    
    // Verify messages are shown as pending
    await expect(page.locator('.message-pending').first()).toContainText('Offline message 1');
    await expect(page.locator('.message-pending').nth(1)).toContainText('Offline message 2');
    
    // Go back online
    await page.context().setOffline(false);
    
    // Wait for messages to be sent
    await expect(page.locator('.message-pending')).toHaveCount(0, { timeout: 5000 });
    
    // Verify messages are now shown as sent
    await expect(page.locator('.message-sent').first()).toContainText('Offline message 1');
    await expect(page.locator('.message-sent').nth(1)).toContainText('Offline message 2');
  });
  
  test('should sync missed messages after reconnection', async ({ page, context }) => {
    // Setup: Login with first user and send a message
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    await page.click('text=John Doe');
    
    // Second user logs in
    const secondBrowser = await context.newPage();
    await secondBrowser.goto('/login');
    await secondBrowser.fill('input[name="email"]', 'john@example.com');
    await secondBrowser.fill('input[name="password"]', 'password123');
    await secondBrowser.click('button[type="submit"]');
    await secondBrowser.waitForURL('/dashboard');
    await secondBrowser.click('a[href="/messages"]');
    await secondBrowser.click('text=Test User');
    
    // Second user goes offline
    await secondBrowser.context().setOffline(true);
    
    // First user sends messages while second user is offline
    await page.fill('textarea[placeholder="Type a message..."]', 'Message while you were offline 1');
    await page.click('button[aria-label="Send message"]');
    
    await page.fill('textarea[placeholder="Type a message..."]', 'Message while you were offline 2');
    await page.click('button[aria-label="Send message"]');
    
    // Second user comes back online
    await secondBrowser.context().setOffline(false);
    
    // Verify second user receives the missed messages
    await expect(secondBrowser.locator('.message-bubble').last()).toContainText('Message while you were offline 2', { timeout: 5000 });
    await expect(secondBrowser.locator('.message-bubble').nth(-2)).toContainText('Message while you were offline 1');
  });
});
```

### 2. Bandwidth Limitation Testing

Testing the application's performance under constrained bandwidth conditions helps ensure usability on slow connections.

#### Test Cases
- Performance under constrained bandwidth (e.g., 3G, Edge)
- Message delivery with large message volumes
- File attachment handling under low bandwidth
- UI responsiveness during slow transfers

#### Implementation

```typescript
import { test, expect } from '@playwright/test';

test.describe('Bandwidth Limitation Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Simulate slow 3G connection
    await context.route('**/*', (route) => {
      route.continue({
        throttle: {
          downloadSpeed: 50 * 1024, // 50 kb/s
          uploadSpeed: 20 * 1024, // 20 kb/s
          latency: 300 // 300ms
        }
      });
    });
  });
  
  test('should send and receive messages under low bandwidth', async ({ page }) => {
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Open a conversation
    await page.click('text=John Doe');
    
    // Send a message
    const startTime = Date.now();
    await page.fill('textarea[placeholder="Type a message..."]', 'Test message under low bandwidth');
    await page.click('button[aria-label="Send message"]');
    
    // Wait for message to be sent
    await expect(page.locator('.message-sent').last()).toContainText('Test message under low bandwidth');
    const endTime = Date.now();
    
    // Log the time it took to send the message
    console.log(`Message sent in ${endTime - startTime}ms under simulated 3G conditions`);
    
    // Verify UI remained responsive
    await expect(page.locator('textarea[placeholder="Type a message..."]')).toBeEnabled();
  });
  
  test('should handle file attachments under low bandwidth', async ({ page }) => {
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Open a conversation
    await page.click('text=John Doe');
    
    // Attach a file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button[aria-label="Attach file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(500 * 1024) // 500KB test file
    });
    
    // Verify upload progress indicator is shown
    await expect(page.locator('.upload-progress')).toBeVisible();
    
    // Wait for upload to complete (may take longer under throttled conditions)
    await expect(page.locator('.attachment-preview')).toBeVisible({ timeout: 30000 });
    
    // Send the message with attachment
    await page.click('button[aria-label="Send message"]');
    
    // Verify message with attachment is sent
    await expect(page.locator('.message-attachment').last()).toBeVisible({ timeout: 30000 });
  });
});
```

### 3. High Latency Testing

Testing under high network latency conditions helps ensure the application remains usable even when network response times are slow.

#### Test Cases
- Real-time features under latency
- Typing indicators with delayed delivery
- User experience with delayed message receipt
- Concurrent operations under high latency

#### Implementation

```typescript
import { test, expect } from '@playwright/test';

test.describe('High Latency Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Simulate high latency connection (500ms)
    await context.route('**/*', (route) => {
      route.continue({
        throttle: {
          latency: 500 // 500ms latency
        }
      });
    });
  });
  
  test('should handle typing indicators under high latency', async ({ page, context }) => {
    // Login with first user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    await page.click('text=John Doe');
    
    // Second user logs in
    const secondBrowser = await context.newPage();
    await secondBrowser.goto('/login');
    await secondBrowser.fill('input[name="email"]', 'john@example.com');
    await secondBrowser.fill('input[name="password"]', 'password123');
    await secondBrowser.click('button[type="submit"]');
    await secondBrowser.waitForURL('/dashboard');
    await secondBrowser.click('a[href="/messages"]');
    await secondBrowser.click('text=Test User');
    
    // First user starts typing
    await page.fill('textarea[placeholder="Type a message..."]', 'T');
    
    // Verify typing indicator appears for second user (with delay due to latency)
    await expect(secondBrowser.locator('.typing-indicator')).toBeVisible({ timeout: 2000 });
    
    // First user stops typing and waits
    await page.fill('textarea[placeholder="Type a message..."]', '');
    await page.waitForTimeout(2000); // Wait for typing indicator to expire
    
    // Verify typing indicator disappears for second user
    await expect(secondBrowser.locator('.typing-indicator')).not.toBeVisible({ timeout: 2000 });
  });
  
  test('should maintain message order under high latency', async ({ page }) => {
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    await page.click('text=John Doe');
    
    // Send multiple messages in quick succession
    await page.fill('textarea[placeholder="Type a message..."]', 'Message 1');
    await page.click('button[aria-label="Send message"]');
    
    await page.fill('textarea[placeholder="Type a message..."]', 'Message 2');
    await page.click('button[aria-label="Send message"]');
    
    await page.fill('textarea[placeholder="Type a message..."]', 'Message 3');
    await page.click('button[aria-label="Send message"]');
    
    // Wait for all messages to be sent
    await expect(page.locator('.message-sent')).toHaveCount(3, { timeout: 10000 });
    
    // Verify messages are displayed in the correct order
    const messages = await page.locator('.message-bubble').all();
    const lastThreeMessages = messages.slice(-3);
    
    expect(await lastThreeMessages[0].textContent()).toContain('Message 1');
    expect(await lastThreeMessages[1].textContent()).toContain('Message 2');
    expect(await lastThreeMessages[2].textContent()).toContain('Message 3');
  });
});
```

## Device and Screen Size Testing

### 1. Responsive Design Testing

Testing the application's UI across different screen sizes ensures a consistent user experience on all devices.

#### Test Cases
- Layout adaptation for different viewports
- Touch interactions on mobile devices
- Keyboard handling on different devices
- UI element visibility and accessibility

#### Implementation

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design Tests', () => {
  test('should adapt layout for mobile devices', async ({ browser }) => {
    // Use iPhone 12 viewport
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();
    
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Verify mobile layout elements
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.conversation-list.mobile')).toBeVisible();
    
    // Open a conversation
    await page.click('text=John Doe');
    
    // Verify conversation view takes full screen on mobile
    await expect(page.locator('.conversation-list')).not.toBeVisible();
    await expect(page.locator('.message-container.mobile')).toBeVisible();
    
    // Verify back button is present
    await expect(page.locator('button[aria-label="Back to conversations"]')).toBeVisible();
    
    // Test back button
    await page.click('button[aria-label="Back to conversations"]');
    await expect(page.locator('.conversation-list')).toBeVisible();
  });
  
  test('should adapt layout for tablet devices', async ({ browser }) => {
    // Use iPad viewport
    const context = await browser.newContext({
      ...devices['iPad (gen 7)'],
    });
    const page = await context.newPage();
    
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Verify tablet layout (split view)
    await expect(page.locator('.conversation-list.tablet')).toBeVisible();
    await expect(page.locator('.message-container.tablet')).toBeVisible();
    
    // Verify both panels are visible simultaneously
    await page.click('text=John Doe');
    await expect(page.locator('.conversation-list')).toBeVisible();
    await expect(page.locator('.message-container')).toBeVisible();
  });
  
  test('should adapt layout for desktop devices', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Verify desktop layout
    await expect(page.locator('.conversation-list.desktop')).toBeVisible();
    await expect(page.locator('.message-container.desktop')).toBeVisible();
    
    // Verify additional desktop features
    await expect(page.locator('.sidebar-navigation')).toBeVisible();
    await expect(page.locator('.user-settings-panel')).toBeVisible();
  });
});
```

### 2. Browser Compatibility

Testing across different browsers ensures the application works consistently for all users.

#### Test Cases
- Functionality in major browsers (Chrome, Firefox, Safari, Edge)
- WebCrypto API compatibility
- IndexedDB storage for encryption keys
- WebSocket support for Realtime

#### Implementation

```typescript
// This is configured in playwright.config.ts to run tests across multiple browsers
// Example configuration:

// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'] },
    },
  ],
};

export default config;
```

### 3. Performance Testing

Testing the application's performance across different devices helps ensure a good user experience for all users.

#### Test Cases
- CPU and memory usage on low-end devices
- Battery consumption during active messaging
- Background processing efficiency
- Startup time and initial loading performance

#### Implementation

```typescript
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should measure startup time', async ({ page }) => {
    // Start performance measurement
    await page.evaluate(() => {
      window.performance.mark('start_measurement');
    });
    
    // Navigate to the app
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    
    // Wait for the app to be fully loaded
    await page.waitForSelector('.conversation-list', { state: 'visible' });
    
    // End performance measurement
    const metrics = await page.evaluate(() => {
      window.performance.mark('end_measurement');
      window.performance.measure('app_startup', 'start_measurement', 'end_measurement');
      return window.performance.getEntriesByName('app_startup')[0];
    });
    
    console.log(`App startup time: ${metrics.duration}ms`);
    
    // Assert startup time is within acceptable range
    expect(metrics.duration).toBeLessThan(5000); // 5 seconds max
  });
  
  test('should measure message sending performance', async ({ page }) => {
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    await page.click('text=John Doe');
    
    // Measure time to send a message
    await page.evaluate(() => {
      window.performance.mark('send_start');
    });
    
    await page.fill('textarea[placeholder="Type a message..."]', 'Performance test message');
    await page.click('button[aria-label="Send message"]');
    
    // Wait for message to be sent
    await page.waitForSelector('.message-sent:has-text("Performance test message")');
    
    const sendMetrics = await page.evaluate(() => {
      window.performance.mark('send_end');
      window.performance.measure('message_send', 'send_start', 'send_end');
      return window.performance.getEntriesByName('message_send')[0];
    });
    
    console.log(`Message send time: ${sendMetrics.duration}ms`);
    
    // Assert send time is within acceptable range
    expect(sendMetrics.duration).toBeLessThan(2000); // 2 seconds max
  });
  
  test('should measure memory usage during active messaging', async ({ page }) => {
    // This test requires Chrome DevTools Protocol which is only available in Chromium
    test.skip(({ browserName }) => browserName !== 'chromium', 'This test requires Chrome DevTools Protocol');
    
    // Login and navigate to messaging
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.click('a[href="/messages"]');
    await page.click('text=John Doe');
    
    // Measure baseline memory
    const baselineMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
    
    // Send multiple messages to simulate active usage
    for (let i = 0; i < 20; i++) {
      await page.fill('textarea[placeholder="Type a message..."]', `Performance test message ${i}`);
      await page.click('button[aria-label="Send message"]');
      await page.waitForTimeout(200);
    }
    
    // Measure memory after active usage
    const activeMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
    
    const memoryIncrease = activeMemory - baselineMemory;
    console.log(`Memory increase during active messaging: ${memoryIncrease / (1024 * 1024)} MB`);
    
    // Assert memory increase is within acceptable range
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max increase
  });
});
```

These cross-functional tests help ensure the encrypted messaging system works well across different network conditions, device types, and browsers, providing a consistent and reliable user experience for all users.