import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForTokens,
  saveHoneyBookTokens,
  createHoneyBookWebhook,
  saveHoneyBookWebhook
} from '@/utils/honeybook/api-helpers';

/**
 * Handles the OAuth callback from HoneyBook
 * Exchanges the authorization code for access and refresh tokens
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle error response from HoneyBook
    if (error) {
      console.error('HoneyBook OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/dashboard/organization?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/organization?error=Invalid+OAuth+callback', request.url)
      );
    }

    // Get the stored state from the cookie
    const cookieStore = cookies();
    const storedState = cookieStore.get('honeybook_oauth_state');
    const orgId = cookieStore.get('honeybook_oauth_org_id');
    
    const storedStateValue = storedState?.value;
    const orgIdValue = orgId?.value;

    // Validate state to prevent CSRF attacks
    if (!storedStateValue || state !== storedStateValue) {
      return NextResponse.redirect(
        new URL('/dashboard/organization?error=Invalid+OAuth+state', request.url)
      );
    }

    // Validate organization ID
    if (!orgIdValue) {
      return NextResponse.redirect(
        new URL('/dashboard/organization?error=Missing+organization+ID', request.url)
      );
    }

    // Exchange the authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Save the tokens to the database
    await saveHoneyBookTokens(orgIdValue, tokenResponse);

    // Register webhooks for job events
    try {
      // Define the webhook URL
      const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const webhookUrl = `${webhookBaseUrl}/api/honeybook/webhook`;

      // Register webhook for project creation events
      const projectCreatedWebhook = await createHoneyBookWebhook('project.created', webhookUrl);
      await saveHoneyBookWebhook(orgIdValue, projectCreatedWebhook);

      // Register webhook for project update events
      const projectUpdatedWebhook = await createHoneyBookWebhook('project.updated', webhookUrl);
      await saveHoneyBookWebhook(orgIdValue, projectUpdatedWebhook);

      console.log('Successfully registered HoneyBook webhooks');
    } catch (webhookError) {
      // Log the error but don't fail the OAuth flow
      console.error('Error registering HoneyBook webhooks:', webhookError);
    }

    // Clear the OAuth cookies
    cookieStore.set('honeybook_oauth_state', '', { maxAge: 0 });
    cookieStore.set('honeybook_oauth_org_id', '', { maxAge: 0 });

    // Redirect to the organization dashboard with success message
    return NextResponse.redirect(
      new URL('/dashboard/organization?success=HoneyBook+account+connected+successfully', request.url)
    );
  } catch (error) {
    console.error('Error handling HoneyBook OAuth callback:', error);
    
    // Redirect to the organization dashboard with error message
    return NextResponse.redirect(
      new URL('/dashboard/organization?error=Failed+to+connect+HoneyBook+account', request.url)
    );
  }
}