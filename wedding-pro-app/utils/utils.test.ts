import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodedRedirect } from './utils';
import { redirect } from 'next/navigation';

// Mock the next/navigation module
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('encodedRedirect function', () => {
  beforeEach(() => {
    // Clear mock calls between tests
    vi.clearAllMocks();
  });

  it('should create a redirect URL with an encoded error message', () => {
    const path = '/some-path';
    const message = 'Error message with spaces & special chars';
    
    encodedRedirect('error', path, message);
    
    // Check that redirect was called with the correct URL
    expect(redirect).toHaveBeenCalledWith(
      `/some-path?error=${encodeURIComponent(message)}`
    );
  });
  
  it('should create a redirect URL with an encoded success message', () => {
    const path = '/dashboard';
    const message = 'Operation successful!';
    
    encodedRedirect('success', path, message);
    
    // Check that redirect was called with the correct URL
    expect(redirect).toHaveBeenCalledWith(
      `/dashboard?success=${encodeURIComponent(message)}`
    );
  });
});