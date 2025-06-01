import { vi, beforeEach, expect } from 'vitest';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
// Mock Next.js router (This was moved to the specific test file to allow for mockPush)
// vi.mock('next/navigation', () => ({
//   useRouter: () => ({
//     push: vi.fn(),
//     replace: vi.fn(),
//     prefetch: vi.fn(),
//     back: vi.fn(),
//     forward: vi.fn(),
//     refresh: vi.fn(),
//   }),
//   usePathname: () => '/',
//   useSearchParams: () => new URLSearchParams(),
//   redirect: vi.fn(),
// }));

// Mock for window.getComputedStyle
const mockGetComputedStyle = vi.fn((elt) => {
  // A basic mock for getComputedStyle
  if (typeof window !== 'undefined') {
    // Attempt to use the real getComputedStyle if available in the JSDOM env
    // and fallback if it's not fully implemented or causes issues.
    try {
      const realStyle = window.getComputedStyle(elt);
      return {
        ...realStyle,
        getPropertyValue: (prop: string): string => realStyle.getPropertyValue(prop),
        overflow: realStyle.overflow || 'auto',
        paddingRight: realStyle.paddingRight || '0px',
      };
    } catch (e) {
      // Fallback if real getComputedStyle fails
    }
  }
  return {
    getPropertyValue: (prop: string): string => '',
    overflow: 'auto',
    paddingRight: '0px',
    // Add other properties as needed by components like react-remove-scroll-bar
    position: '',
    display: '',
    width: '',
    height: '',
  };
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    configurable: true
  });
} else {
  // @ts-ignore
  global.window = global.window || {};
  // @ts-ignore
  global.window.getComputedStyle = mockGetComputedStyle;
}


// Mock for ResizeObserver
class MockResizeObserver {
  observe() {
    // do nothing
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'ResizeObserver', {
    value: MockResizeObserver,
    configurable: true
  });
} else {
  // @ts-ignore
  global.ResizeObserver = MockResizeObserver;
}


// Mock for window.confirm
const mockConfirm = vi.fn(() => true); // Default to true (user clicked "OK")
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'confirm', {
    value: mockConfirm,
    configurable: true
  });
} else {
  // @ts-ignore
  global.confirm = mockConfirm;
}

// Mock sessionStorage
export const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true // Make it configurable so it can be redefined if needed
  })
} else {
  // @ts-ignore
  global.window = global.window || {};
  // @ts-ignore
  global.window.sessionStorage = mockSessionStorage;
}

// Add any global test setup here
global.IS_REACT_ACT_ENVIRONMENT = true;