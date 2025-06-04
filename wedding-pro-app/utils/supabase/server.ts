import { createServerClient } from "@supabase/ssr";
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

// Create a separate import for next/headers to allow for dynamic imports
let cookiesModule: typeof import("next/headers") | null = null;

/**
 * Safely gets the cookies module if we're in a Server Component environment
 */
const getCookiesModule = async () => {
  if (cookiesModule) return cookiesModule;
  
  try {
    // Dynamic import to prevent build errors in pages/ directory
    cookiesModule = await import("next/headers");
    return cookiesModule;
  } catch (error) {
    // We're not in a Server Component environment
    return null;
  }
};

/**
 * Creates a Supabase client for Server Components and App Router Route Handlers.
 * WARNING: This can only be used in Server Components or App Router Route Handlers.
 * For API Routes, pages/ directory, or Edge Functions, use createAPIClient instead.
 *
 * @throws Error if used outside of a Server Component or App Router Route Handler
 */
export const createClient = async () => {
  const cookiesModule = await getCookiesModule();
  
  if (!cookiesModule) {
    throw new Error(
      "createClient() can only be used in Server Components or App Router Route Handlers. " +
      "For pages/ directory or API Routes, use createAPIClient() instead."
    );
  }
  
  const { cookies } = cookiesModule;
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options: Partial<ResponseCookie>) {
          try {
            const cookieStore = await cookies();
            cookieStore.set(name, value, options);
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        async remove(name: string, options: Partial<ResponseCookie>) {
          try {
            const cookieStore = await cookies();
            // Set an expired cookie to remove it
            cookieStore.set(name, '', {
              ...options,
              maxAge: 0,
              expires: new Date(0)
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

/**
 * Creates a Supabase client for API Routes, pages/ directory, and Edge Functions.
 * This version doesn't use next/headers and is safe to use in any context.
 */
export const createAPIClient = async (req: Request) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookies = req.headers.get('cookie')?.split(';') || [];
          const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
          return cookie?.split('=')[1];
        },
        set(name: string, value: string, options: any) {
          // No-op for API routes as we can't set cookies directly
          // Use res.setHeader('Set-Cookie', ...) in your API route instead
        },
        remove(name: string, options: any) {
          // No-op for API routes as we can't remove cookies directly
          // Use res.setHeader('Set-Cookie', ...) in your API route instead
        },
      },
    },
  );
};

/**
 * Creates a Supabase client with service role privileges for admin operations.
 * This client has full admin access and should only be used server-side.
 * WARNING: Never expose this client or its key to the client-side.
 */
export const createServiceRoleClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations"
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() { /* no-op */ },
        remove() { /* no-op */ },
      },
    }
  );
};

/**
 * LEGACY EXPORT - Only for backward compatibility
 * @deprecated Use createClient() or createAPIClient() directly
 */
export const createServerComponentClient = async () => {
  console.warn(
    "createServerComponentClient() is deprecated. " +
    "Use createClient() for Server Components or createAPIClient() for API Routes."
  );
  return await createClient();
};
