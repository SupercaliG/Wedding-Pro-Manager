# Testing Tools and Frameworks

This document outlines the tools and frameworks used for testing the encrypted messaging system in the Wedding Pro application.

## Primary Testing Tools

### 1. Vitest

[Vitest](https://vitest.dev/) is the primary testing framework used for unit and integration testing in the Wedding Pro application.

#### Key Features
- Fast execution with native ESM support
- Compatible with Vue and React components
- Snapshot testing
- Code coverage reporting
- Watch mode for development
- Compatible with TypeScript

#### Usage in Wedding Pro
- Unit testing of utility functions
- Component testing with React Testing Library
- Integration testing of services
- Mock implementations for external dependencies

#### Example Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/'],
    },
  },
});
```

### 2. Playwright

[Playwright](https://playwright.dev/) is used for end-to-end testing of the Wedding Pro application, allowing testing across multiple browsers.

#### Key Features
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile browser emulation
- Network condition simulation
- Visual testing
- API testing
- Parallel test execution

#### Usage in Wedding Pro
- End-to-end testing of user flows
- Cross-browser compatibility testing
- Responsive design testing
- Performance testing
- Network condition testing

#### Example Configuration

```typescript
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
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
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
};

export default config;
```

### 3. React Testing Library

[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) is used for testing React components in a way that resembles how users interact with the application.

#### Key Features
- Encourages testing from a user's perspective
- Queries that encourage accessible code
- Simple and intuitive API
- Works with any test runner

#### Usage in Wedding Pro
- Component rendering tests
- User interaction tests
- Accessibility testing
- Integration with Vitest

#### Example Usage

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import MessageComposer from '../../components/messaging/message-composer';

describe('MessageComposer', () => {
  it('should send a message when the send button is clicked', () => {
    const handleSend = vi.fn();
    render(<MessageComposer onSendMessage={handleSend} />);
    
    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    
    expect(handleSend).toHaveBeenCalledWith('Hello world');
  });
});
```

### 4. Supabase Local Development

Supabase provides local development tools that allow testing database operations, RLS policies, and edge functions locally.

#### Key Features
- Local Postgres database
- Local API server
- Local authentication
- Local edge functions
- Local Realtime server

#### Usage in Wedding Pro
- Testing database migrations
- Validating RLS policies
- Testing edge functions
- Testing Realtime subscriptions

#### Example Setup

```bash
# Start Supabase local development
supabase start

# Run migrations
supabase db reset

# Test edge functions
supabase functions serve get-virgil-jwt --no-verify-jwt

# Stop Supabase local development
supabase stop
```

## Testing Environment Setup

### Test Setup File

```typescript
// test/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Setup MSW server for API mocking
export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

### Mock Implementations

#### Virgil E3Kit Mock

```typescript
// mocks/virgil-e3kit-mock.ts
export const mockVirgilE3Kit = {
  EThree: {
    initialize: vi.fn().mockImplementation(() => ({
      register: vi.fn(),
      cleanup: vi.fn(),
      backupPrivateKey: vi.fn(),
      restorePrivateKey: vi.fn(),
      findUsers: vi.fn().mockImplementation((users) => {
        const result = {};
        users.forEach(user => {
          result[user] = { publicKey: `mock-public-key-${user}` };
        });
        return Promise.resolve(result);
      }),
      encrypt: vi.fn().mockImplementation((message) => 
        Promise.resolve(`encrypted:${message}`)),
      decrypt: vi.fn().mockImplementation((message) => 
        Promise.resolve(message.replace('encrypted:', ''))),
      createGroup: vi.fn().mockImplementation((groupId) => ({
        encrypt: vi.fn().mockImplementation((message) => 
          Promise.resolve(`group-encrypted:${groupId}:${message}`)),
        decrypt: vi.fn().mockImplementation((message) => 
          Promise.resolve(message.replace(`group-encrypted:${groupId}:`, ''))),
        add: vi.fn(),
        remove: vi.fn()
      }))
    }))
  }
};
```

#### Supabase Client Mock

```typescript
// mocks/supabase-client-mock.ts
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
  },
  channel: vi.fn().mockImplementation((channel) => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation((callback) => {
      // Store callback for later triggering
      mockSupabaseClient._channels[channel] = callback;
      return { unsubscribe: vi.fn() };
    })
  })),
  from: vi.fn().mockImplementation((table) => ({
    insert: vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
    select: vi.fn().mockResolvedValue({ 
      data: mockSupabaseClient._tables[table] || [], 
      error: null 
    }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis()
  })),
  // Mock data storage
  _tables: {
    messages: [],
    conversations: [],
    participants: []
  },
  _channels: {},
  // Helper to simulate connection status
  _connectionStatus: 'ONLINE',
  setConnectionStatus: (status) => {
    mockSupabaseClient._connectionStatus = status;
  },
  // Helper to add data to mock tables
  _addData: (table, data) => {
    if (!mockSupabaseClient._tables[table]) {
      mockSupabaseClient._tables[table] = [];
    }
    mockSupabaseClient._tables[table].push(data);
    return data;
  }
};
```

### MSW Handlers

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Mock Virgil JWT endpoint
  rest.get('/functions/v1/get-virgil-jwt', (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Unauthorized' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        token: 'mock-virgil-jwt-token'
      })
    );
  }),
  
  // Mock conversation endpoints
  rest.get('/api/conversations', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 'conv-1', participants: ['user-123', 'user-456'] },
        { id: 'conv-2', participants: ['user-123', 'user-789'] }
      ])
    );
  }),
  
  // Mock messages endpoints
  rest.get('/api/conversations/:id/messages', (req, res, ctx) => {
    const { id } = req.params;
    
    return res(
      ctx.status(200),
      ctx.json([
        { id: 'msg-1', conversation_id: id, sender_id: 'user-456', content: 'encrypted:Hello', created_at: '2025-05-17T10:00:00Z' },
        { id: 'msg-2', conversation_id: id, sender_id: 'user-123', content: 'encrypted:Hi there', created_at: '2025-05-17T10:01:00Z' }
      ])
    );
  }),
  
  rest.post('/api/messages', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-msg-id',
        conversation_id: req.body.conversation_id,
        sender_id: 'user-123',
        content: req.body.content,
        created_at: new Date().toISOString()
      })
    );
  })
];
```

## Continuous Integration Setup

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit and integration tests
      run: npm test
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test coverage
      uses: actions/upload-artifact@v3
      with:
        name: coverage
        path: coverage/
    
    - name: Upload Playwright report
      uses: actions/upload-artifact@v3
      with:
        name: playwright-report
        path: playwright-report/
```

## Test Scripts

```json
// package.json (test scripts)
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:security": "node security/penetration-tests.js"
  }
}
```

## Best Practices

1. **Write Tests First**: Follow a test-driven development approach when possible.
2. **Test Behavior, Not Implementation**: Focus on testing what the code does, not how it does it.
3. **Use Realistic Test Data**: Create test data that resembles real-world usage.
4. **Mock External Dependencies**: Use mocks for external services like Supabase and Virgil E3Kit.
5. **Test Edge Cases**: Include tests for error conditions and edge cases.
6. **Maintain Test Independence**: Each test should be able to run independently of others.
7. **Keep Tests Fast**: Optimize tests to run quickly to encourage frequent testing.
8. **Review Test Coverage**: Regularly review test coverage reports to identify untested code.
9. **Automate Testing**: Run tests automatically in CI/CD pipelines.
10. **Update Tests with Code Changes**: Keep tests up to date as the codebase evolves.

These tools and frameworks provide a comprehensive testing infrastructure for the encrypted messaging system, ensuring code quality, functionality, and security.