"use server";

import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/utils";
// import { revalidatePath } from "next/cache"; // Not used in createOrganizationWithAdmin
// import { createNotificationService, NotificationEventType } from "@/utils/notifications/notification-service"; // Not used
// import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers"; // Not used
import { slugify } from "@/lib/utils";

/**
 * Generates a unique organization ID.
 * Checks against the database and appends a suffix if a collision occurs.
 */
const generateUniqueOrganizationId = async (
  supabase: SupabaseClient<Database>,
  orgName: string
): Promise<string> => {
  let baseSlug = slugify(orgName);
  let uniqueId = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("orgs")
      .select("organization_id")
      .eq("organization_id", uniqueId)
      .maybeSingle();

    if (error) {
      console.error("Error checking organization_id uniqueness:", error);
      // Fallback or rethrow, depending on desired error handling
      // For now, let's append a random string as a simple fallback, though this isn't ideal for production
      return `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;
    }

    if (!data) {
      return uniqueId; // ID is unique
    }

    // Collision detected, append suffix and try again
    uniqueId = `${baseSlug}-${suffix}`;
    suffix++;
  }
};

/**
 * Create a new organization with the first user as Admin
 */
export const createOrganizationWithAdmin = async (formData: FormData) => {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    return encodedRedirect(
      "error",
      "/sign-up",
      "Failed to initialize application. Please try again later.",
      "org"
    );
  }

  let origin;
  try {
    origin = (await headers()).get("origin");
    if (!origin) {
      throw new Error("Origin header not found");
    }
  } catch (error) {
    console.error("Failed to get origin header:", error);
    return encodedRedirect(
      "error",
      "/sign-up",
      "Failed to process request. Please try again.",
      "org"
    );
  }

  // Extract form data
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const orgName = formData.get("orgName")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();

  if (!email || !password || !orgName) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email, password, and organization name are required",
      "org"
    );
  }

  // Start a transaction by using supabase functions
  try {
    // 1. Create the user
    const { data: userData, error: userError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (userError || !userData.user) {
      console.error(userError);
      return encodedRedirect("error", "/sign-up", userError?.message || "Failed to create user", "org");
    }

    // 2. Call the database function to create org and update profile
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_org_and_admin_profile', {
      new_user_id: userData.user.id,
      new_org_name: orgName,
      new_org_contact_email: email,
      new_user_full_name: fullName,
      new_user_phone_number: phoneNumber
    });

    if (rpcError || !rpcData) {
      console.error("Error calling create_org_and_admin_profile RPC:", rpcError);
      console.error("RPC Data:", rpcData);
      // The RPC function might raise an exception or return an error structure.
      // Adjust error handling based on how your RPC function signals errors.
      return encodedRedirect("error", "/sign-up", `Failed to finalize organization setup: ${rpcError?.message || 'RPC error'}`, "org");
    }
    
    // The RPC function returns a record with created_org_db_id and generated_organization_id
    const generatedOrganizationId = rpcData.generated_organization_id;
    // const createdOrgDbId = rpcData.created_org_db_id; // Available if needed

    if (!generatedOrganizationId) {
      console.error("RPC did not return generated_organization_id");
      return encodedRedirect("error", "/sign-up", "Failed to get organization ID after creation.", "org");
    }
    
    // Step 3: Set active_org_id in user's app_metadata.
    // This requires admin privileges, so we use a service role client.
    // Note: This is a non-critical operation - if it fails, we still consider the signup successful
    try {
      const adminSupabase = createServiceRoleClient();
      const existingAppMetadata = userData.user.app_metadata || {};
      const { error: appMetadataError } = await adminSupabase.auth.admin.updateUserById(
        userData.user.id,
        { app_metadata: { ...existingAppMetadata, active_org_id: generatedOrganizationId } }
      );

      if (appMetadataError) {
        console.warn("Non-critical: Error setting active_org_id in app_metadata:", appMetadataError);
        // This is logged as a warning since it doesn't affect the core signup success
      }
    } catch (adminError) {
      console.warn("Non-critical: Error updating user metadata:", adminError);
      // This is logged as a warning since it doesn't affect the core signup success
    }

  } catch (error) {
    console.error("Transaction error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    
    // Check for specific error types
    if (errorMessage.includes("duplicate key") || errorMessage.includes("already exists")) {
      return encodedRedirect("error", "/sign-up", "An account with this email already exists", "org");
    }
    
    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return encodedRedirect("error", "/sign-up", "Network error. Please check your connection and try again", "org");
    }
    
    return encodedRedirect("error", "/sign-up", "Failed to create organization. Please try again later", "org");
  }

  // Success redirect - use encodedRedirect for consistency
  return encodedRedirect(
    "success",
    "/sign-up",
    "Organization created successfully! Please check your email for verification.",
    "org"
  );
};

/**
 * Fetches the list of organizations a user is a member of and the current active_org_id.
 * Includes organization ID and name for memberships.
 */
export interface UserMembershipDetails {
  organization_id: string; // Textual unique ID (e.g., "acme-corp")
  name: string;
  org_db_id: string; // UUID primary key from 'orgs' table
}

export interface UserMembershipsResponse {
  memberships: UserMembershipDetails[];
  activeOrgId: string | null;
  error?: string | null;
}

export const getUserMemberships = async (): Promise<UserMembershipsResponse> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user:", userError);
      return { memberships: [], activeOrgId: null, error: "User not authenticated." };
    }

    const activeOrgId = user.app_metadata?.active_org_id as string | undefined || null;

    const { data: membershipsData, error: membershipsError } = await supabase
      .from("user_organization_memberships")
      .select(
        `
        organization_id,
        orgs (
          name,
          id
        )
      `
      )
      .eq("user_id", user.id);

    if (membershipsError) {
      console.error("Error fetching user memberships:", membershipsError);
      return { memberships: [], activeOrgId, error: "Failed to fetch memberships." };
    }

    if (!membershipsData) {
      return { memberships: [], activeOrgId, error: "No membership data found." };
    }
    
    // Transform the data to the desired flat structure
    const transformedMemberships = membershipsData.map((membership) => {
      // Assuming 'orgs' should be a single related object, but typed as an array.
      // Access the first element if it's an array and exists.
      const orgData = Array.isArray(membership.orgs) && membership.orgs.length > 0
        ? membership.orgs[0]
        : membership.orgs;

      return {
        organization_id: membership.organization_id,
        name: (orgData as { name?: string })?.name || "Unnamed Organization",
        org_db_id: (orgData as { id?: string })?.id || "",
      };
    }).filter(m => m.organization_id && m.name && m.org_db_id);

    return { memberships: transformedMemberships, activeOrgId };

  } catch (error) {
    console.error("Unexpected error in getUserMemberships:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return { memberships: [], activeOrgId: null, error: errorMessage };
  }
};