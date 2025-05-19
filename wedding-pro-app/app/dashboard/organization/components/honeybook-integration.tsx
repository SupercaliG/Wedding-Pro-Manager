'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

type HoneyBookStatus = {
  connected: boolean;
  token: {
    id: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    scope?: string;
  } | null;
  webhooks_active: boolean;
  webhooks: {
    id: string;
    event_type: string;
    created_at: string;
  }[];
};

export default function HoneyBookIntegration() {
  // Import the feature flag
  const { FEATURES } = require('@/utils/feature-flags');
  
  // If HoneyBook integration is disabled, return null (don't render anything)
  if (!FEATURES.SHOW_HONEYBOOK_INTEGRATION) {
    return null;
  }
  
  const [status, setStatus] = useState<HoneyBookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const router = useRouter();

  // Check for success or error messages in the URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('success');
    const errorMessage = urlParams.get('error');

    if (successMessage) {
      setError(null);
    } else if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    }

    // Clean up URL parameters after reading them
    if (successMessage || errorMessage) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Fetch the current HoneyBook connection status
  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoading(true);
        const response = await fetch('/api/honeybook/status');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch HoneyBook status');
        }
        
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  // Handle initiating the OAuth flow
  const handleConnect = () => {
    window.location.href = '/api/honeybook/authorize';
  };

  // Handle revoking the OAuth token
  const handleRevoke = async () => {
    try {
      setRevokeLoading(true);
      const response = await fetch('/api/honeybook/revoke', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke HoneyBook connection');
      }
      
      // Update the status
      setStatus(prev => prev ? { ...prev, connected: false, token: null } : null);
      setError(null);
      
      // Refresh the page to show the updated status
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setRevokeLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div id="honeybook" className="bg-white rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">HoneyBook Integration</h2>
      
      {loading ? (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${status?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              {status?.connected ? 'Connected to HoneyBook' : 'Not connected to HoneyBook'}
            </span>
          </div>

          {/* Webhook Status */}
          {status?.connected && (
            <div className="flex items-center mt-2">
              <div className={`h-3 w-3 rounded-full mr-2 ${status?.webhooks_active ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="font-medium">
                {status?.webhooks_active ? 'Webhooks Active' : 'Webhooks Inactive'}
              </span>
            </div>
          )}

          {/* Token Details (if connected) */}
          {status?.connected && status.token && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="text-md font-medium mb-2">Connection Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Connected since:</span>{' '}
                  <span>{formatDate(status.token.created_at)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Last updated:</span>{' '}
                  <span>{formatDate(status.token.updated_at)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Expires at:</span>{' '}
                  <span>{formatDate(status.token.expires_at)}</span>
                </div>
                {status.token.scope && (
                  <div>
                    <span className="text-gray-600">Permissions:</span>{' '}
                    <span>{status.token.scope}</span>
                  </div>
                )}
              </div>

              {/* Webhook Details */}
              {status.webhooks_active && status.webhooks.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-1">Active Webhooks:</h4>
                  <ul className="text-xs space-y-1">
                    {status.webhooks.map(webhook => (
                      <li key={webhook.id} className="text-gray-600">
                        {webhook.event_type}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            {!status?.connected ? (
              <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700">
                Connect HoneyBook Account
              </Button>
            ) : (
              <Button 
                onClick={handleRevoke} 
                className="bg-red-600 hover:bg-red-700"
                disabled={revokeLoading}
              >
                {revokeLoading ? 'Disconnecting...' : 'Disconnect HoneyBook Account'}
              </Button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-sm text-gray-500 mt-2">
            {!status?.connected 
              ? 'Connect your HoneyBook account to sync projects and manage your wedding business from one place.'
              : 'Your HoneyBook account is connected. You can disconnect it at any time.'}
          </p>
        </div>
      )}
    </div>
  );
}