"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation"; // Keep this if encodedRedirect doesn't re-export it
import { encodedRedirect } from "@/utils/utils";

interface InvitationCodeData {
  id: string; // UUID
  org_id: string; // UUID
  expires_at: string | null; // TIMESTAMPTZ string
  max_uses: number | null;
  uses_count: number;
}

/**
 * Handle employee self-signup using an organization invitation code.
 */
export const employeeSelfSignup = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();
  const orgCode = formData.get("orgCode")?.toString(); // Organization invitation code
  
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password || !fullName || !orgCode) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email, password, full name, and organization code are required.",
      "employee"
    );
  }

  try {
    // 1. Validate Organization Code using RPC
    const { data: rawInvitationCodeData, error: invitationCodeError } = await supabase
      .rpc('validate_organization_invitation_code', { input_code: orgCode })
      .single();

    if (invitationCodeError || !rawInvitationCodeData) {
      console.error("Error fetching invitation code:", invitationCodeError?.message || "No data returned from RPC");
      return encodedRedirect("error", "/sign-up", "Invalid or expired organization code.", "employee");
    }
    
    // Cast the data to the expected interface
    const invitationCodeData = rawInvitationCodeData as unknown as InvitationCodeData;

    // Check expiration
    if (invitationCodeData.expires_at) {
      const expiresAt = new Date(invitationCodeData.expires_at);
      if (new Date() > expiresAt) {
        return encodedRedirect("error", "/sign-up", "Organization code has expired.", "employee");
      }
    }

    // Check max uses
    if (invitationCodeData.max_uses !== null && invitationCodeData.uses_count >= invitationCodeData.max_uses) {
      return encodedRedirect("error", "/sign-up", "Organization code has reached its maximum number of uses.", "employee");
    }

    const orgUuid = invitationCodeData.org_id; // This is the orgs.id (UUID) from the invitation code

    // Fetch the TEXT organization_id using the UUID
    const { data: orgDataSignup, error: orgFetchErrorSignup } = await supabase
      .from('orgs')
      .select('organization_id')
      .eq('id', orgUuid)
      .single();

    if (orgFetchErrorSignup || !orgDataSignup) {
      console.error("Error fetching organization details for signup code:", orgFetchErrorSignup);
      return encodedRedirect("error", "/sign-up", "Invalid organization details linked to code.", "employee");
    }
    const textOrgIdSignup = orgDataSignup.organization_id;


    // 2. Create the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: { // This becomes raw_app_meta_data
          full_name: fullName,
          phone_number: phoneNumber,
          active_org_id: textOrgIdSignup // Set active_org_id (TEXT)
        }
      },
    });

    if (signUpError || !signUpData.user) {
      console.error("Sign up error:", signUpError?.code, signUpError?.message);
      if (signUpError?.message.includes("User already registered")) {
        return encodedRedirect("error", "/sign-up", "An account with this email already exists.", "employee");
      }
      return encodedRedirect("error", "/sign-up", signUpError?.message || "Failed to create user.", "employee");
    }

    const userId = signUpData.user.id;

    // 3. Update the user's profile with org_id, role, and approval_status
    // This assumes a profile row is created by a trigger on auth.users insert.
    // If not, this should be an .insert() or .upsert().
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        org_id: orgUuid, // Keep using the UUID for profiles.org_id FK
        role: 'Employee', 
        approval_status: 'pending', // Self-signups are pending approval
        full_name: fullName,
        phone_number: phoneNumber
      })
      .eq('id', userId);

    if (profileError) {
      console.error("Profile update error for self-signup:", profileError);
      // Consider cleanup: delete auth.users entry if profile update fails.
      return encodedRedirect("error", "/sign-up", "Failed to update user profile. Please contact support.", "employee");
    }

    // 4. Increment uses_count for the invitation code
    const { error: incrementError } = await supabase
      .from('organization_invitation_codes')
      .update({ uses_count: invitationCodeData.uses_count + 1 })
      .eq('id', invitationCodeData.id);

    if (incrementError) {
      console.error("Error incrementing invitation code uses_count:", incrementError);
      // Log this error, but the user signup was successful.
    }
      
    // 5. Send notification to managers/admins about the new user registration (TODO)
    // Example:
    // const notificationService = createNotificationService(supabase);
    // await notificationService.sendNotificationForEvent({ eventType: 'new_user_pending_approval', ... });


    return encodedRedirect(
      "success",
      "/sign-up", // Or a dedicated "pending approval" page
      "Signup successful! Your account is pending approval. You will be notified once it's reviewed.",
      "employee" 
    );

  } catch (error) {
    console.error("Error during employee self-signup:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return encodedRedirect("error", "/sign-up", `Signup failed: ${errorMessage}`, "employee");
  }
};