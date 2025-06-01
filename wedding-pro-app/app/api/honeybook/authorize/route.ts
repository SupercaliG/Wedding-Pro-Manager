import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin, getCurrentUserProfile } from '@/utils/supabase/auth-helpers';
import { getHoneyBookAuthUrl } from '@/utils/honeybook/api-helpers';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initiates the HoneyBook OAuth flow
 * This endpoint should only be accessible to Admin users
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if the user is an admin
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can connect HoneyBook accounts.' },
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

    // Generate a state parameter to prevent CSRF attacks
    const state = uuidv4();
    
    // Store the state and org_id in a cookie for verification during callback
    const cookieStore = await cookies();
    cookieStore.set('honeybook_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });
    
    cookieStore.set('honeybook_oauth_org_id', profile.org_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    // Generate the authorization URL
    const authUrl = getHoneyBookAuthUrl(state);

    // Redirect to the HoneyBook authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating HoneyBook OAuth flow:', error);
    return NextResponse.json(
      { error: 'Failed to initiate HoneyBook OAuth flow' },
      { status: 500 }
    );
  }
}