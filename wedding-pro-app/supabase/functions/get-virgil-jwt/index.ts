import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Virgil Crypto SDK for JWT generation
// Note: In a real implementation, you would use the actual Virgil Crypto SDK
// For this example, we're using a simplified JWT generation approach
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const virgilApiKey = Deno.env.get("VIRGIL_API_KEY") || "";
const virgilAppId = Deno.env.get("VIRGIL_APP_ID") || "";

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate a JWT token for Virgil Security authentication
 * @param identity User identity (usually user ID)
 * @returns JWT token
 */
function generateVirgilJwt(identity: string): string {
  if (!virgilApiKey || !virgilAppId) {
    throw new Error("Missing Virgil Security configuration");
  }

  // In a real implementation, you would use the Virgil Crypto SDK to generate a proper JWT
  // For this example, we're creating a simplified JWT structure
  
  // JWT header
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  
  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000);
  
  // JWT payload
  const payload = {
    iss: virgilAppId,
    sub: identity,
    iat: now,
    exp: now + 3600, // Token expires in 1 hour
    // Add any additional claims needed by Virgil Security
  };
  
  // Encode header and payload
  const encodedHeader = base64Encode(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
    
  const encodedPayload = base64Encode(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  // Create signature (in a real implementation, this would use proper HMAC-SHA256)
  // For this example, we're creating a placeholder signature
  // WARNING: This is NOT secure and should NOT be used in production
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = base64Encode(
    new TextEncoder().encode(`${data}${virgilApiKey}`)
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  // Combine to create JWT
  return `${data}.${signature}`;
}

/**
 * Verify that the request is from an authenticated user
 * @param request HTTP request
 * @returns User ID if authenticated, null otherwise
 */
async function getUserId(request: Request): Promise<string | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return null;
    }
    
    // Extract the token
    const token = authHeader.replace("Bearer ", "");
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error("Error verifying user:", error);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  
  try {
    // Verify the user is authenticated
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // Parse the request body
    const { identity } = await req.json();
    
    // Ensure the identity matches the authenticated user
    // This prevents users from generating tokens for other users
    if (identity !== userId) {
      return new Response(JSON.stringify({ error: "Identity mismatch" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // Generate the JWT token
    const token = generateVirgilJwt(identity);
    
    // Return the token
    return new Response(JSON.stringify({ token }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error generating Virgil JWT:", error);
    
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});