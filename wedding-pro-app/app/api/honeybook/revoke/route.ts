import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getCurrentUserProfile } from '@/utils/supabase/auth-helpers';
import { revokeHoneyBookToken, deactivateHoneyBookWebhooks } from '@/utils/honeybook/api-helpers';

/**
 * Revokes the HoneyBook OAuth token for the current organization.
 * This endpoint should only be accessible to Admin users.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if the user is an admin
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can disconnect HoneyBook accounts.' },
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

    // Revoke the token
    await revokeHoneyBookToken(profile.org_id);

    // Deactivate webhooks
    try {
      await deactivateHoneyBookWebhooks(profile.org_id);
    } catch (webhookError) {
      // Log the error but don't fail the revocation flow
      console.error('Error deactivating HoneyBook webhooks:', webhookError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking HoneyBook OAuth token:', error);
    return NextResponse.json(
      { error: 'Failed to revoke HoneyBook OAuth token' },
      { status: 500 }
    );
  }
}