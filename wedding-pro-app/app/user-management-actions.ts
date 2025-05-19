"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/utils";
import { revalidatePath } from "next/cache";
import { createNotificationService, NotificationEventType } from "@/utils/notifications/notification-service";

/**
 * Create a new organization with the first user as Admin
 */
export const createOrganizationWithAdmin = async (formData: FormData) => {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

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
      return encodedRedirect("error", "/sign-up", userError?.message || "Failed to create user");
    }

    // 2. Create the organization
    const { data: orgData, error: orgError } = await supabase
      .from('orgs')
      .insert([
        { 
          name: orgName, 
          owner_user_id: userData.user.id,
          contact_email: email
        }
      ])
      .select()
      .single();

    if (orgError || !orgData) {
      console.error(orgError);
      return encodedRedirect("error", "/sign-up", "Failed to create organization");
    }

    // 3. Update the user's profile with org_id, role, and approval_status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        org_id: orgData.id, 
        role: 'Admin', 
        approval_status: 'approved',
        full_name: fullName,
        phone_number: phoneNumber
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error(profileError);
      return encodedRedirect("error", "/sign-up", "Failed to update user profile");
    }

    return encodedRedirect(
      "success",
      "/sign-up",
      "Organization created successfully! Please check your email for verification.",
    );
  } catch (error) {
    console.error("Transaction error:", error);
    return encodedRedirect("error", "/sign-up", "An unexpected error occurred");
  }
};

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
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  // Verify current user is an Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'Admin') {
    return encodedRedirect("error", "/dashboard", "Only Admins can invite managers");
  }

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
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        phone_number: phoneNumber,
        invited_by: user.id,
        org_id: profile.org_id
      },
      password: Math.random().toString(36).slice(-10), // Random temporary password
    });

    if (userError || !userData.user) {
      console.error(userError);
      return encodedRedirect("error", "/dashboard/invite", userError?.message || "Failed to create user");
    }

    // Update the profile with org_id, role, and approval_status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        org_id: profile.org_id, 
        role: 'Manager', 
        approval_status: 'approved',
        full_name: fullName,
        phone_number: phoneNumber
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error(profileError);
      return encodedRedirect("error", "/dashboard/invite", "Failed to update user profile");
    }

    // Send password reset email so they can set their own password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
    });

    if (resetError) {
      console.error(resetError);
      // We don't redirect with error here because the user was created successfully
      // Just log the error and continue
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", "Manager invited successfully");
  } catch (error) {
    console.error("Error inviting manager:", error);
    return encodedRedirect("error", "/dashboard/invite", "An unexpected error occurred");
  }
};

/**
 * Invite a new employee to the organization
 * Admins and Managers can invite employees
 */
export const inviteEmployee = async (formData: FormData) => {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Get current user to verify they're an Admin or Manager
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  // Verify current user is an Admin or Manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'Admin' && profile.role !== 'Manager')) {
    return encodedRedirect("error", "/dashboard", "Only Admins and Managers can invite employees");
  }

  // Extract form data
  const email = formData.get("email")?.toString();
  const fullName = formData.get("fullName")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString();
  const autoApprove = formData.get("autoApprove") === "on";

  if (!email || !fullName) {
    return encodedRedirect("error", "/dashboard/invite", "Email and name are required");
  }

  try {
    // Create user with admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        phone_number: phoneNumber,
        invited_by: user.id,
        org_id: profile.org_id
      },
      password: Math.random().toString(36).slice(-10), // Random temporary password
    });

    if (userError || !userData.user) {
      console.error(userError);
      return encodedRedirect("error", "/dashboard/invite", userError?.message || "Failed to create user");
    }

    // Set approval status based on who invited them and autoApprove setting
    const approvalStatus = autoApprove ? 'approved' : 'pending';

    // Update the profile with org_id, role, and approval_status
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
      console.error(profileError);
      return encodedRedirect("error", "/dashboard/invite", "Failed to update user profile");
    }

    // Send password reset email so they can set their own password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
    });

    if (resetError) {
      console.error(resetError);
      // We don't redirect with error here because the user was created successfully
      // Just log the error and continue
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", "Employee invited successfully");
  } catch (error) {
    console.error("Error inviting employee:", error);
    return encodedRedirect("error", "/dashboard/invite", "An unexpected error occurred");
  }
};

/**
 * Update a user's approval status
 * Only Admins can approve/reject users
 * Managers can only approve/reject Employees in their org
 */
export const updateUserApprovalStatus = async (formData: FormData) => {
  const supabase = await createClient();

  // Get current user to verify they're an Admin or Manager
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  // Verify current user is an Admin or Manager
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .single();

  if (!currentUserProfile || (currentUserProfile.role !== 'Admin' && currentUserProfile.role !== 'Manager')) {
    return encodedRedirect("error", "/dashboard", "Only Admins and Managers can update approval status");
  }

  // Extract form data
  const userId = formData.get("userId")?.toString();
  const action = formData.get("action")?.toString();

  if (!userId || !action || (action !== 'approve' && action !== 'reject')) {
    return encodedRedirect("error", "/dashboard/users", "Invalid request");
  }

  try {
    // Get the target user's profile
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role, org_id, full_name, email')
      .eq('id', userId)
      .single();

    if (!targetProfile) {
      return encodedRedirect("error", "/dashboard/users", "User not found");
    }

    // Verify the target user is in the same org
    if (targetProfile.org_id !== currentUserProfile.org_id) {
      return encodedRedirect("error", "/dashboard/users", "You can only manage users in your organization");
    }

    // If current user is a Manager, they can only approve/reject Employees
    if (currentUserProfile.role === 'Manager' && targetProfile.role !== 'Employee') {
      return encodedRedirect("error", "/dashboard/users", "Managers can only approve/reject Employees");
    }

    // Update the approval status
    const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ approval_status: approvalStatus })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      return encodedRedirect("error", "/dashboard/users", "Failed to update user status");
    }

    // Send notification to the user about their approval status
    try {
      const notificationService = createNotificationService(supabase);
      
      // Determine the notification event type based on the action
      const eventType: NotificationEventType = action === 'approve'
        ? 'org_announcement' // Using org_announcement for user approval
        : 'org_announcement'; // Using org_announcement for user rejection
      
      // Create appropriate notification message
      const title = action === 'approve' ? 'Account Approved' : 'Account Rejected';
      const body = action === 'approve'
        ? `Your account has been approved by ${currentUserProfile.full_name || 'an administrator'}. You can now access all features.`
        : `Your account has been rejected by ${currentUserProfile.full_name || 'an administrator'}. Please contact support for more information.`;
      
      await notificationService.sendNotificationForEvent({
        eventType,
        userId,
        title,
        body,
        metadata: {
          action,
          approvedBy: user.id,
          approverName: currentUserProfile.full_name,
          timestamp: new Date().toISOString(),
          userRole: targetProfile.role
        }
      });
    } catch (notificationError) {
      // Log notification error but don't fail the approval/rejection process
      console.error("Error sending approval notification:", notificationError);
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", `User ${action}d successfully`);
  } catch (error) {
    console.error("Error updating user status:", error);
    return encodedRedirect("error", "/dashboard/users", "An unexpected error occurred");
  }
};

/**
 * Get all users in the current user's organization
 * Filtered by approval status if provided
 */
export const getOrganizationUsers = async (approvalStatus?: string) => {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }

  // Get current user's org_id
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!currentUserProfile || !currentUserProfile.org_id) {
    return { error: "You are not part of an organization" };
  }

  // Build the query
  let query = supabase
    .from('profiles')
    .select(`
      id, 
      role, 
      approval_status, 
      full_name, 
      phone_number, 
      created_at,
      auth_users:id(email)
    `)
    .eq('org_id', currentUserProfile.org_id);

  // Add approval status filter if provided
  if (approvalStatus) {
    query = query.eq('approval_status', approvalStatus);
  }

  // Execute the query
  const { data, error } = await query;

  if (error) {
    console.error(error);
    return { error: "Failed to fetch users" };
  }

  return { data };
};

/**
 * Update the standard sign-up action to handle employee self-signup
 * This is a modified version of the signUpAction from actions.ts
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
      "Email, password, name, and organization code are required",
    );
  }

  try {
    // Verify the org code is valid and get the org_id
    // This would be implemented in a real system, but for now we'll just use the code as the org_id
    // In a real implementation, you would have a separate table for invitation codes
    const orgId = orgCode;

    // Create the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          full_name: fullName,
          phone_number: phoneNumber,
          org_id: orgId
        }
      },
    });

    if (error) {
      console.error(error.code + " " + error.message);
      return encodedRedirect("error", "/sign-up", error.message);
    }

    // Update the profile with org_id, role, and approval_status
    // Note: This might not be necessary if you have a trigger that sets these values
    // But we'll do it explicitly here to be sure
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          org_id: orgId,
          role: 'Employee',
          approval_status: 'pending',
          full_name: fullName,
          phone_number: phoneNumber
        })
        .eq('id', data.user.id);

      if (profileError) {
        console.error(profileError);
        // Continue anyway since the user was created
      }
      
      // Send notification to managers about the new user registration
      try {
        // Get managers for this organization
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId)
          .in('role', ['Manager', 'Admin']);
        
        if (managers && managers.length > 0) {
          const notificationService = createNotificationService(supabase);
          
          // Send notification to each manager
          for (const manager of managers) {
            await notificationService.sendNotificationForEvent({
              eventType: 'org_announcement', // Using org_announcement for new user registration
              userId: manager.id,
              title: 'New User Registration',
              body: `${fullName} has registered as an employee and is awaiting approval.`,
              metadata: {
                userId: data.user.id,
                userName: fullName,
                userEmail: email,
                userPhone: phoneNumber,
                registeredAt: new Date().toISOString(),
                orgId
              }
            });
          }
        }
      } catch (notificationError) {
        // Log notification error but don't fail the registration process
        console.error("Error sending new user registration notification:", notificationError);
      }
    }

    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link. Your account will need to be approved by an administrator.",
    );
  } catch (error) {
    console.error("Error during self-signup:", error);
    return encodedRedirect("error", "/sign-up", "An unexpected error occurred");
  }
};