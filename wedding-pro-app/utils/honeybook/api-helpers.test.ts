import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHoneyBookAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  isTokenExpiredOrExpiring,
  HoneyBookOAuthToken
} from './api-helpers';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    HONEYBOOK_CLIENT_ID: 'test-client-id',
    HONEYBOOK_CLIENT_SECRET: 'test-client-secret',
    HONEYBOOK_REDIRECT_URI: 'https://test.com/callback',
    HONEYBOOK_AUTH_URL: 'https://api.honeybook.com/oauth/authorize',
    HONEYBOOK_TOKEN_URL: 'https://api.honeybook.com/oauth/token',
    HONEYBOOK_API_BASE_URL: 'https://api.honeybook.com/v1'
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('HoneyBook API Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHoneyBookAuthUrl', () => {
    it('should generate the correct authorization URL', () => {
      const state = 'test-state';
      const url = getHoneyBookAuthUrl(state);
      
      expect(url).toContain('https://api.honeybook.com/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.com%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('scope=projects%3Aread+projects%3Awrite+webhooks%3Amanage');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await exchangeCodeForTokens('test-code');
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.honeybook.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: expect.stringContaining('code=test-code')
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw an error if the request fails', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' })
      });
      
      await expect(exchangeCodeForTokens('invalid-code')).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await refreshAccessToken('test-refresh-token');
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.honeybook.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: expect.stringContaining('refresh_token=test-refresh-token')
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw an error if the request fails', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' })
      });
      
      await expect(refreshAccessToken('invalid-refresh-token')).rejects.toThrow();
    });
  });

  describe('isTokenExpiredOrExpiring', () => {
    it('should return true for expired tokens', () => {
      const expiredToken: HoneyBookOAuthToken = {
        id: 'test-id',
        org_id: 'test-org-id',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        is_active: true
      };
      
      expect(isTokenExpiredOrExpiring(expiredToken)).toBe(true);
    });
    
    it('should return true for tokens expiring soon (within 5 minutes)', () => {
      const expiringToken: HoneyBookOAuthToken = {
        id: 'test-id',
        org_id: 'test-org-id',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(), // 4 minutes from now
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        is_active: true
      };
      
      expect(isTokenExpiredOrExpiring(expiringToken)).toBe(true);
    });
    
    it('should return false for valid tokens', () => {
      const validToken: HoneyBookOAuthToken = {
        id: 'test-id',
        org_id: 'test-org-id',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        is_active: true
      };
      
      expect(isTokenExpiredOrExpiring(validToken)).toBe(false);
    });
  });
});