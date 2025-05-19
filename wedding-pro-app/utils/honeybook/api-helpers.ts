import { createClient } from '@/utils/supabase/server';
import { getCurrentUserProfile, isAdmin } from '@/utils/supabase/auth-helpers';
import crypto from 'crypto';

/**
 * Types for HoneyBook OAuth tokens and webhooks
 */
export type HoneyBookTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type HoneyBookOAuthToken = {
  id: string;
  org_id: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  scope?: string;
};

/**
 * Types for HoneyBook webhooks
 */
export type HoneyBookWebhookResponse = {
  id: string;
  event_type: string;
  target_url: string;
  created_at: string;
  updated_at: string;
};

export type HoneyBookWebhook = {
  id: string;
  org_id: string;
  webhook_id: string;
  event_type: string;
  target_url: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

/**
 * Generate the authorization URL for HoneyBook OAuth
 * @param state A random string to prevent CSRF attacks
 * @returns The authorization URL
 */
export function getHoneyBookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.HONEYBOOK_CLIENT_ID!,
    redirect_uri: process.env.HONEYBOOK_REDIRECT_URI!,
    response_type: 'code',
    state,
    scope: 'projects:read projects:write webhooks:manage',
  });

  return `${process.env.HONEYBOOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens
 * @param code The authorization code from HoneyBook
 * @returns The token response
 */
export async function exchangeCodeForTokens(code: string): Promise<HoneyBookTokenResponse> {
  const params = new URLSearchParams({
    client_id: process.env.HONEYBOOK_CLIENT_ID!,
    client_secret: process.env.HONEYBOOK_CLIENT_SECRET!,
    redirect_uri: process.env.HONEYBOOK_REDIRECT_URI!,
    grant_type: 'authorization_code',
    code,
  });

  const response = await fetch(process.env.HONEYBOOK_TOKEN_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to exchange code for tokens: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Refresh an access token using a refresh token
 * @param refreshToken The refresh token
 * @returns The new token response
 */
export async function refreshAccessToken(refreshToken: string): Promise<HoneyBookTokenResponse> {
  const params = new URLSearchParams({
    client_id: process.env.HONEYBOOK_CLIENT_ID!,
    client_secret: process.env.HONEYBOOK_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(process.env.HONEYBOOK_TOKEN_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to refresh access token: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Save HoneyBook OAuth tokens to the database
 * @param orgId The organization ID
 * @param tokenResponse The token response from HoneyBook
 * @returns The saved token record
 */
export async function saveHoneyBookTokens(
  orgId: string,
  tokenResponse: HoneyBookTokenResponse
): Promise<HoneyBookOAuthToken | null> {
  const supabase = await createClient();
  
  // Calculate the expiration date
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
  
  // Check if a token already exists for this organization
  const { data: existingToken, error: fetchError } = await supabase
    .from('honeybook_oauth_tokens')
    .select('id')
    .eq('org_id', orgId)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    throw new Error(`Failed to check for existing tokens: ${fetchError.message}`);
  }
  
  let result;
  
  if (existingToken) {
    // Update existing token
    result = await supabase
      .from('honeybook_oauth_tokens')
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        token_type: tokenResponse.token_type,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        scope: tokenResponse.scope,
      })
      .eq('id', existingToken.id)
      .select()
      .single();
  } else {
    // Insert new token
    result = await supabase
      .from('honeybook_oauth_tokens')
      .insert({
        org_id: orgId,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        token_type: tokenResponse.token_type,
        expires_at: expiresAt.toISOString(),
        scope: tokenResponse.scope,
      })
      .select()
      .single();
  }
  
  if (result.error) {
    throw new Error(`Failed to save tokens: ${result.error.message}`);
  }
  
  return result.data;
}

/**
 * Get the active HoneyBook OAuth token for the current user's organization
 * @returns The token or null if not found
 */
export async function getHoneyBookToken(): Promise<HoneyBookOAuthToken | null> {
  // Check if the user is an admin
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    throw new Error('Only admins can access HoneyBook tokens');
  }
  
  // Get the current user's organization
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    throw new Error('User is not associated with an organization');
  }
  
  const supabase = await createClient();
  
  // Get the active token for this organization
  const { data, error } = await supabase
    .from('honeybook_oauth_tokens')
    .select('*')
    .eq('org_id', profile.org_id)
    .eq('is_active', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') { // No rows returned
      return null;
    }
    throw new Error(`Failed to get HoneyBook token: ${error.message}`);
  }
  
  return data;
}

/**
 * Check if a token is expired or about to expire (within 5 minutes)
 * @param token The token to check
 * @returns True if the token is expired or about to expire
 */
export function isTokenExpiredOrExpiring(token: HoneyBookOAuthToken): boolean {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  
  // Add a 5-minute buffer to handle potential clock skew
  now.setMinutes(now.getMinutes() + 5);
  
  return now >= expiresAt;
}

/**
 * Get a valid access token, refreshing if necessary
 * @returns A valid access token or null if not available
 */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const token = await getHoneyBookToken();
    
    if (!token) {
      return null;
    }
    
    // If the token is expired or about to expire, refresh it
    if (isTokenExpiredOrExpiring(token)) {
      const tokenResponse = await refreshAccessToken(token.refresh_token);
      const profile = await getCurrentUserProfile();
      
      if (!profile || !profile.org_id) {
        throw new Error('User is not associated with an organization');
      }
      
      const updatedToken = await saveHoneyBookTokens(profile.org_id, tokenResponse);
      return updatedToken?.access_token || null;
    }
    
    return token.access_token;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    return null;
  }
}

/**
 * Make an authenticated request to the HoneyBook API
 * @param endpoint The API endpoint (without the base URL)
 * @param options Fetch options
 * @returns The response data
 */
export async function honeyBookApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error('No valid HoneyBook access token available');
  }
  
  const url = `${process.env.HONEYBOOK_API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`HoneyBook API request failed: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
}

/**
 * Revoke a HoneyBook OAuth token
 * @param orgId The organization ID
 * @returns True if successful
 */
export async function revokeHoneyBookToken(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Get the token for this organization
  const { data: token, error: fetchError } = await supabase
    .from('honeybook_oauth_tokens')
    .select('*')
    .eq('org_id', orgId)
    .single();
  
  if (fetchError) {
    if (fetchError.code === 'PGRST116') { // No rows returned
      return true; // No token to revoke
    }
    throw new Error(`Failed to get HoneyBook token: ${fetchError.message}`);
  }
  
  // Call HoneyBook API to revoke the token
  try {
    const params = new URLSearchParams({
      client_id: process.env.HONEYBOOK_CLIENT_ID!,
      client_secret: process.env.HONEYBOOK_CLIENT_SECRET!,
      token: token.access_token,
    });
    
    await fetch(`${process.env.HONEYBOOK_API_BASE_URL}/oauth/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (error) {
    console.error('Error revoking token with HoneyBook:', error);
    // Continue to mark the token as inactive even if the API call fails
  }
  
  // Mark the token as inactive in our database
  const { error: updateError } = await supabase
    .from('honeybook_oauth_tokens')
    .update({ is_active: false })
    .eq('id', token.id);
  
  if (updateError) {
    throw new Error(`Failed to mark token as inactive: ${updateError.message}`);
  }
  
  return true;
}

/**
 * Create a webhook subscription with HoneyBook
 * @param eventType The event type to subscribe to (e.g., 'project.created')
 * @param targetUrl The URL to receive webhook events
 * @returns The webhook response
 */
export async function createHoneyBookWebhook(
  eventType: string,
  targetUrl: string
): Promise<HoneyBookWebhookResponse> {
  return await honeyBookApiRequest<HoneyBookWebhookResponse>('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      event_type: eventType,
      target_url: targetUrl,
    }),
  });
}

/**
 * Delete a webhook subscription with HoneyBook
 * @param webhookId The ID of the webhook to delete
 * @returns True if successful
 */
export async function deleteHoneyBookWebhook(webhookId: string): Promise<boolean> {
  try {
    await honeyBookApiRequest(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.error('Error deleting HoneyBook webhook:', error);
    return false;
  }
}

/**
 * Save a HoneyBook webhook to the database
 * @param orgId The organization ID
 * @param webhookResponse The webhook response from HoneyBook
 * @returns The saved webhook record
 */
export async function saveHoneyBookWebhook(
  orgId: string,
  webhookResponse: HoneyBookWebhookResponse
): Promise<HoneyBookWebhook | null> {
  const supabase = await createClient();
  
  // Check if a webhook already exists for this organization and event type
  const { data: existingWebhook, error: fetchError } = await supabase
    .from('honeybook_webhooks')
    .select('id')
    .eq('org_id', orgId)
    .eq('event_type', webhookResponse.event_type)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    throw new Error(`Failed to check for existing webhooks: ${fetchError.message}`);
  }
  
  let result;
  
  if (existingWebhook) {
    // Update existing webhook
    result = await supabase
      .from('honeybook_webhooks')
      .update({
        webhook_id: webhookResponse.id,
        target_url: webhookResponse.target_url,
        is_active: true,
      })
      .eq('id', existingWebhook.id)
      .select()
      .single();
  } else {
    // Insert new webhook
    result = await supabase
      .from('honeybook_webhooks')
      .insert({
        org_id: orgId,
        webhook_id: webhookResponse.id,
        event_type: webhookResponse.event_type,
        target_url: webhookResponse.target_url,
      })
      .select()
      .single();
  }
  
  if (result.error) {
    throw new Error(`Failed to save webhook: ${result.error.message}`);
  }
  
  return result.data;
}

/**
 * Get all active HoneyBook webhooks for the current user's organization
 * @returns Array of webhooks or empty array if none found
 */
export async function getHoneyBookWebhooks(): Promise<HoneyBookWebhook[]> {
  // Check if the user is an admin
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    throw new Error('Only admins can access HoneyBook webhooks');
  }
  
  // Get the current user's organization
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    throw new Error('User is not associated with an organization');
  }
  
  const supabase = await createClient();
  
  // Get all active webhooks for this organization
  const { data, error } = await supabase
    .from('honeybook_webhooks')
    .select('*')
    .eq('org_id', profile.org_id)
    .eq('is_active', true);
  
  if (error) {
    throw new Error(`Failed to get HoneyBook webhooks: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Mark all webhooks for an organization as inactive
 * @param orgId The organization ID
 * @returns True if successful
 */
export async function deactivateHoneyBookWebhooks(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Get all active webhooks for this organization
  const { data: webhooks, error: fetchError } = await supabase
    .from('honeybook_webhooks')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);
  
  if (fetchError) {
    throw new Error(`Failed to get HoneyBook webhooks: ${fetchError.message}`);
  }
  
  // If no webhooks, nothing to do
  if (!webhooks || webhooks.length === 0) {
    return true;
  }
  
  // Delete each webhook from HoneyBook
  for (const webhook of webhooks) {
    try {
      await deleteHoneyBookWebhook(webhook.webhook_id);
    } catch (error) {
      console.error(`Error deleting webhook ${webhook.webhook_id}:`, error);
      // Continue to mark webhooks as inactive even if API calls fail
    }
  }
  
  // Mark all webhooks as inactive in our database
  const { error: updateError } = await supabase
    .from('honeybook_webhooks')
    .update({ is_active: false })
    .eq('org_id', orgId)
    .eq('is_active', true);
  
  if (updateError) {
    throw new Error(`Failed to mark webhooks as inactive: ${updateError.message}`);
  }
  
  return true;
}

/**
 * Verify the signature of a webhook request from HoneyBook
 * @param signature The signature from the request header
 * @param payload The raw request body
 * @returns True if the signature is valid
 */
export function verifyWebhookSignature(signature: string, payload: string): boolean {
  try {
    const secret = process.env.HONEYBOOK_WEBHOOK_SECRET;
    if (!secret) {
      console.error('HONEYBOOK_WEBHOOK_SECRET is not set');
      return false;
    }
    
    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = hmac.update(payload).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}