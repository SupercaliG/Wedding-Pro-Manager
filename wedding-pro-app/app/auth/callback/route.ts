import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // The `/auth/callback` route is required for the server-side auth flow implemented
    // by the SSR package. It exchanges an auth code for the user's session.
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const origin = requestUrl.origin;
    const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

    if (!code) {
      throw new Error("No code provided");
    }

    const supabase = await createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      console.error("Error exchanging code for session:", sessionError);
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(sessionError.message)}`);
    }

    if (!sessionData || !sessionData.user) {
      console.error("No user data found in session after code exchange");
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("Failed to retrieve user session.")}`);
    }

    const userId = sessionData.user.id;

    // Query user_organization_memberships to determine organization count
    const { data: memberships, error: membershipError } = await supabase
      .from("user_organization_memberships")
      .select("organization_id", { count: "exact" })
      .eq("user_id", userId);

    if (membershipError) {
      console.error("Error fetching user organization memberships:", membershipError);
      // Decide on a redirect, perhaps to dashboard with an error, or sign-in
      return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent("Error fetching organization details.")}`);
    }
    
    const organizationCount = memberships?.length || 0;

    if (organizationCount === 1 && memberships) {
      const singleOrgId = memberships[0].organization_id;
      // Call public.set_active_user_organization
      const { error: setActiveOrgError } = await supabase.rpc("set_active_user_organization", {
        p_user_id: userId,
        p_organization_id: singleOrgId,
      });

      if (setActiveOrgError) {
        console.error("Error setting active organization:", setActiveOrgError);
        // Redirect, possibly with an error message
        return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent("Error setting active organization.")}`);
      }
      // Successfully set active org, proceed with normal redirect
      if (redirectTo) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
      return NextResponse.redirect(`${origin}/protected`);

    } else if (organizationCount > 1) {
      // User belongs to multiple organizations, prompt for selection
      // The actual UI for /select-organization will be built in 54.6
      const selectOrgUrl = new URL(`${origin}/select-organization`);
      if (redirectTo) {
        selectOrgUrl.searchParams.set("redirect_to", redirectTo);
      }
      return NextResponse.redirect(selectOrgUrl.toString());
    } else {
      // No organizations or an unexpected scenario (e.g. orgCount is 0)
      // This might mean the user needs to create or join an organization first.
      // For now, redirect to dashboard, which might handle this state.
      // Or, redirect to a specific "no-organization" page if one exists.
      console.warn(`User ${userId} has ${organizationCount} organizations. Redirecting to dashboard.`);
       if (redirectTo) {
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
      return NextResponse.redirect(`${origin}/protected`); // Or a more specific page like /create-organization
    }
  } catch (error) {
    console.error("Error in auth callback:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(errorMessage)}`);
  }
}
