import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const publicPaths = [
      "/",
      "/sign-in",
      "/sign-up",
      "/auth/callback",
      "/forgot-password", // Assuming this is a public path
      "/smtp-message",    // Assuming this is a generic message page
      "/select-organization", // This page must be accessible to select an org
      // Add any other public API routes or static asset paths if necessary
    ];

    const isPublicPath = publicPaths.some(p => request.nextUrl.pathname.startsWith(p));
    // Allow /protected/reset-password as it's usually token-based and doesn't require immediate org_id
    const isResetPasswordPath = request.nextUrl.pathname.startsWith("/protected/reset-password");


    if (user && !authError) { // User is authenticated
      const activeOrgId = user.app_metadata?.active_org_id;
      const userId = user.id; // For logging

      // If user is authenticated and on a public auth page (like sign-in), redirect to dashboard or select-org
      if (request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up")) {
        if (activeOrgId) {
          console.log(`Middleware: Authenticated user ${userId} with active_org_id on ${request.nextUrl.pathname}, redirecting to /dashboard.`);
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } else {
          console.log(`Middleware: Authenticated user ${userId} without active_org_id on ${request.nextUrl.pathname}, redirecting to /select-organization.`);
          return NextResponse.redirect(new URL("/select-organization", request.url));
        }
      }

      // For all other non-public paths, check for active_org_id
      if (!isPublicPath && !isResetPasswordPath) {
        if (!activeOrgId) {
          console.log(`Middleware: User ${userId} authenticated but no active_org_id. Redirecting from ${request.nextUrl.pathname} to /select-organization.`);
          return NextResponse.redirect(new URL("/select-organization", request.url));
        }
        // User has active_org_id and is on a protected route, allow access.
      }
      // If it's a public path or reset password path, and user is authenticated, allow access.

    } else { // User is NOT authenticated (authError or no user)
      // If trying to access a non-public, non-reset-password route, redirect to /sign-in.
      if (!isPublicPath && !isResetPasswordPath) {
        console.log(`Middleware: Unauthenticated user trying to access ${request.nextUrl.pathname}. Redirecting to /sign-in.`);
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      // User is not authenticated but is on a public path or reset password path, allow access.
    }

    return response;
  } catch (e) {
    console.error("Middleware error:", e); // Log the actual error
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
