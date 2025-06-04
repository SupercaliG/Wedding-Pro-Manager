"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation"; // Keep this if encodedRedirect doesn't re-export it
import { encodedRedirect } from "@/utils/utils";
import { revalidatePath } from "next/cache";
// import { createNotificationService, NotificationEventType } from "@/utils/notifications/notification-service"; // Not used in these functions directly
// import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers"; // Not used directly

/**
 * Invite a new manager to the organization
 * Only Admins can create managers
 */
export const inviteManager = async (formData: FormData) => {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Get current user to verify they're an Admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // For dashboard actions, formType might not be relevant unless the redirect target uses it.
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  // Verify current user is an Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'Admin' || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "Only Admins can invite managers");
  }

  // Fetch the TEXT organization_id for the admin's org
  const { data: orgData, error: orgFetchError } = await supabase
    .from('orgs')
    .select('organization_id')
    .eq('id', profile.org_id) // profile.org_id is UUID
    .single();

  if (orgFetchError || !orgData) {
    console.error("Error fetching organization details for admin:", orgFetchError);
    return encodedRedirect("error", "/dashboard/invite", "Failed to retrieve organization details.");
  }
  const textOrganizationId = orgData.organization_id;

  // Extract form data
  const email = formData.get("email")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();

  if (!email || !fullName) {
    return encodedRedirect("error", "/dashboard/invite", "Email and name are required");
  }

  try {
    // Create user with admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email for invited users
      user_metadata: { 
        full_name: fullName,
        phone_number: phoneNumber,
        invited_by: user.id,
        org_id: profile.org_id, // This is the UUID of the org (from profiles.org_id)
        active_org_id: textOrganizationId // This is the TEXT ID of the org
      },
      password: Math.random().toString(36).slice(-10), // Random temporary password
    });

    if (userError || !userData.user) {
      console.error("Error creating manager user:", userError);
      return encodedRedirect("error", "/dashboard/invite", userError?.message || "Failed to create user");
    }

    // Update the profile with org_id, role, and approval_status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        org_id: profile.org_id, 
        role: 'Manager', 
        approval_status: 'approved', // Managers are auto-approved
        full_name: fullName,
        phone_number: phoneNumber
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error("Error updating manager profile:", profileError);
      return encodedRedirect("error", "/dashboard/invite", "Failed to update user profile");
    }

    // Send password reset email so they can set their own password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
    });

    if (resetError) {
      console.error("Error sending password reset for manager:", resetError);
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", "Manager invited successfully");
  } catch (error) {
    console.error("Error inviting manager:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (errorMessage.includes("User already exists")) {
        return encodedRedirect("error", "/dashboard/invite", "A user with this email already exists.");
    }
    return encodedRedirect("error", "/dashboard/invite", "An unexpected error occurred while inviting manager.");
  }
};

/**
 * Invite a new employee to the organization
 * Admins and Managers can invite employees
 */
export const inviteEmployee = async (formData: FormData) => {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'Admin' && profile.role !== 'Manager') || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "Only Admins and Managers can invite employees");
  }

  const { data: orgDataInviter, error: orgFetchErrorInviter } = await supabase
    .from('orgs')
    .select('organization_id')
    .eq('id', profile.org_id)
    .single();

  if (orgFetchErrorInviter || !orgDataInviter) {
    console.error("Error fetching organization details for inviter:", orgFetchErrorInviter);
    return encodedRedirect("error", "/dashboard/invite", "Failed to retrieve organization details.");
  }
  const textOrganizationIdInviter = orgDataInviter.organization_id;

  const email = formData.get("email")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();
  const autoApprove = formData.get("autoApprove") === "on";

  if (!email || !fullName) {
    return encodedRedirect("error", "/dashboard/invite", "Email and name are required");
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        phone_number: phoneNumber,
        invited_by: user.id,
        org_id: profile.org_id,
        active_org_id: textOrganizationIdInviter
      },
      password: Math.random().toString(36).slice(-10),
    });

    if (userError || !userData.user) {
      console.error("Error creating employee user:", userError);
      return encodedRedirect("error", "/dashboard/invite", userError?.message || "Failed to create user");
    }

    const approvalStatus = autoApprove ? 'approved' : 'pending';

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        org_id: profile.org_id, 
        role: 'Employee', 
        approval_status: approvalStatus,
        full_name: fullName,
        phone_number: phoneNumber
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error("Error updating employee profile:", profileError);
      return encodedRedirect("error", "/dashboard/invite", "Failed to update user profile");
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
    });

    if (resetError) {
      console.error("Error sending password reset for employee:", resetError);
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", "Employee invited successfully");
  } catch (error) {
    console.error("Error inviting employee:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    if (errorMessage.includes("User already exists")) {
        return encodedRedirect("error", "/dashboard/invite", "A user with this email already exists.");
    }
    return encodedRedirect("error", "/dashboard/invite", "An unexpected error occurred while inviting employee.");
  }
};