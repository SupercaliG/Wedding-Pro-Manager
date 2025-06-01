import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getCurrentUserProfile } from '@/utils/supabase/auth-helpers';
import { getHoneyBookToken, getHoneyBookWebhooks, HoneyBookWebhook } from '@/utils/honeybook/api-helpers';

/**
 * Returns the current HoneyBook connection status for the organization
 * This endpoint should only be accessible to Admin users
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if the user is an admin
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can view HoneyBook connection status.' },
        { status: 403 }
      );
    }

    // Get the current user's organization
    const profile = await getCurrentUserProfile();
    if (!profile || !profile.org_id) {
      return NextResponse.json(
        { error: 'User is not associated with an organization' },
        { status: 400 }
      );
    }

    // Get the HoneyBook token and webhooks
    const token = await getHoneyBookToken();
    let webhooks: HoneyBookWebhook[] = [];
    
    // Only fetch webhooks if we have an active token
    if (token && token.is_active) {
      try {
        webhooks = await getHoneyBookWebhooks();
      } catch (webhookError) {
        console.error('Error fetching HoneyBook webhooks:', webhookError);
        // Continue without webhooks
      }
    }
    
    // Return the connection status
    return NextResponse.json({
      connected: !!token && token.is_active,
      token: token ? {
        id: token.id,
        expires_at: token.expires_at,
        created_at: token.created_at,
        updated_at: token.updated_at,
        is_active: token.is_active,
        scope: token.scope
      } : null,
      webhooks_active: webhooks.length > 0,
      webhooks: webhooks.map(webhook => ({
        id: webhook.id,
        event_type: webhook.event_type,
        created_at: webhook.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting HoneyBook connection status:', error);
    return NextResponse.json(
      { error: 'Failed to get HoneyBook connection status' },
      { status: 500 }
    );
  }
}