"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers"; // Needed for getPendingAccountsViaEdgeFunction
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/utils";
import { revalidatePath } from "next/cache";
import { createNotificationService, NotificationEventType } from "@/utils/notifications/notification-service";
// getCurrentUserProfile is less useful now that we rely on active_org_id from JWT for org context.
// We'll fetch profile details as needed but prioritize active_org_id for org scoping.
// import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers";


/**
 * Update a user's approval status
 * Only Admins can approve/reject users
 * Managers can only approve/reject Employees in their active organization
 */
export const updateUserApprovalStatus = async (formData: FormData) => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/dashboard", "You must be logged in");
  }

  const activeOrgId = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgId) {
    return encodedRedirect("error", "/dashboard", "No active organization selected or found in your session.");
  }

  // Get current user's role from their profile for permission checking.
  // Their specific org_id from profiles table is less relevant now than active_org_id for this action's context.
  const { data: currentUserProfile, error: currentUserProfileError } = await supabase
    .from('profiles')
    .select('role, full_name') // We only need role and name for permission and logging
    .eq('id', user.id)
    .single();

  if (currentUserProfileError || !currentUserProfile) {
    console.error("Error fetching current user profile:", currentUserProfileError);
    return encodedRedirect("error", "/dashboard", "Failed to verify your permissions.");
  }

  if ((currentUserProfile.role !== 'Admin' && currentUserProfile.role !== 'Manager')) {
    return encodedRedirect("error", "/dashboard", "Only Admins and Managers can update approval status");
  }

  const userIdToUpdate = formData.get("userId")?.toString();
  const action = formData.get("action")?.toString(); // 'approve' or 'reject'

  if (!userIdToUpdate || !action || (action !== 'approve' && action !== 'reject')) {
    return encodedRedirect("error", "/dashboard/users", "Invalid request: User ID and action are required.");
  }

  try {
    // Get the target user's profile to find their org_id (UUID)
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('role, org_id, full_name, email')
      .eq('id', userIdToUpdate)
      .single();

    if (targetProfileError || !targetProfile) {
      return encodedRedirect("error", "/dashboard/users", "User not found");
    }
    
    if (!targetProfile.org_id) {
        return encodedRedirect("error", "/dashboard/users", "Target user is not associated with an organization.");
    }

    // Fetch the TEXT organization_id for the target user's org
    const { data: targetOrgData, error: targetOrgFetchError } = await supabase
      .from('orgs')
      .select('organization_id') // TEXT id
      .eq('id', targetProfile.org_id) // profiles.org_id is UUID
      .single();

    if (targetOrgFetchError || !targetOrgData) {
      console.error("Error fetching target user's organization details:", targetOrgFetchError);
      return encodedRedirect("error", "/dashboard/users", "Failed to verify target user's organization.");
    }

    // Verify the target user is in the same *active* org as the current user
    if (targetOrgData.organization_id !== activeOrgId) {
      return encodedRedirect("error", "/dashboard/users", "You can only manage users in your currently active organization");
    }

    // If current user is a Manager, they can only approve/reject Employees
    if (currentUserProfile.role === 'Manager' && targetProfile.role !== 'Employee') {
      return encodedRedirect("error", "/dashboard/users", "Managers can only approve/reject Employees");
    }

    const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ approval_status: approvalStatus })
      .eq('id', userIdToUpdate);

    if (updateError) {
      console.error("Error updating user approval status:", updateError);
      return encodedRedirect("error", "/dashboard/users", "Failed to update user status");
    }

    try {
      const notificationService = createNotificationService(supabase);
      const eventType: NotificationEventType = action === 'approve' ? 'user_approved' : 'user_rejected';
      const title = action === 'approve' ? 'Account Approved' : 'Account Status Update';
      const body = action === 'approve'
        ? `Your account for the organization has been approved by ${currentUserProfile.full_name || 'an administrator'}. You can now access all features.`
        : `Your account status for the organization has been updated to '${approvalStatus}' by ${currentUserProfile.full_name || 'an administrator'}. If you have questions, please contact support.`;
      
      await notificationService.sendNotificationForEvent({
        eventType,
        userId: userIdToUpdate,
        title,
        body,
        metadata: {
          action,
          actorUserId: user.id,
          actorName: currentUserProfile.full_name,
          timestamp: new Date().toISOString(),
          targetUserRole: targetProfile.role,
          orgId: activeOrgId // Use activeOrgId (TEXT)
        }
      });
    } catch (notificationError) {
      console.error("Error sending approval/rejection notification:", notificationError);
    }

    revalidatePath('/dashboard/users');
    return encodedRedirect("success", "/dashboard/users", `User ${action}d successfully`);
  } catch (error) {
    console.error("Error updating user status:", error);
    return encodedRedirect("error", "/dashboard/users", "An unexpected error occurred while updating user status.");
  }
};


/**
 * Get all users in the current user's active organization
 * Filtered by approval status if provided
 */
export const getOrganizationUsers = async (approvalStatus?: string) => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: "You must be logged in" };
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    return { data: null, error: "No active organization selected or found in your session." };
  }

  // Get the UUID of the active organization to filter profiles.org_id
  const { data: activeOrgData, error: activeOrgError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText) // TEXT
    .single();

  if (activeOrgError || !activeOrgData) {
    console.error("Error fetching active organization UUID:", activeOrgError);
    return { data: null, error: "Failed to identify active organization." };
  }
  const activeOrgUuid = activeOrgData.id;

  let query = supabase
    .from('profiles')
    .select(`
      id,
      role,
      approval_status,
      full_name,
      phone_number,
      created_at,
      email 
    `)
    .eq('org_id', activeOrgUuid); // Filter by the active org's UUID

  if (approvalStatus) {
    query = query.eq('approval_status', approvalStatus);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching organization users:", error);
    return { data: null, error: "Failed to fetch users" };
  }

  return { data, error: null };
};

/**
 * Get pending accounts using the Supabase Edge Function
 * This provides an alternative to the direct database query method
 */
export const getPendingAccountsViaEdgeFunction = async () => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: "You must be logged in" };
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    return { data: null, error: "No active organization selected or found in your session." };
  }

  try {
    const { data, error } = await supabase.functions.invoke('account-approval', {
      body: {
        action: 'fetch',
        activeOrgId: activeOrgIdText // Pass TEXT active_org_id
      }
    });

    if (error) {
      console.error('Error invoking account-approval function (fetch):', error);
      return { data: null, error: `Failed to fetch pending accounts: ${error.message}` };
    }
    
    return { data, error: null };
  } catch (error: any) {
    console.error('Exception invoking account-approval function (fetch):', error);
    return { data: null, error: `An unexpected error occurred: ${error.message}` };
  }
};


/**
 * Approve an account using the Supabase Edge Function
 */
export const approveAccountViaEdgeFunction = async (userIdToApprove: string) => {
  const supabase = await createClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) {
    return { success: false, error: "You must be logged in to approve accounts." };
  }
  
  const activeOrgIdText = currentUser.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
      return { success: false, error: "No active organization selected or found in your session." };
  }

  try {
    const { data, error } = await supabase.functions.invoke('account-approval', {
      body: {
        action: 'approve',
        userIdToApprove: userIdToApprove,
        activeOrgId: activeOrgIdText, // Pass TEXT active_org_id
        actorUserId: currentUser.id
      }
    });

    if (error) {
      console.error('Error calling account-approval function (approve):', error);
      return { success: false, error: `Failed to approve account: ${error.message}` };
    }
    
    if (data && data.error) {
        console.error('Error from account-approval function (approve):', data.error);
        return { success: false, error: `Failed to approve account: ${data.error}` };
    }

    revalidatePath('/dashboard/users');
    
    return { success: true, message: "Account approved successfully", data };
  } catch (error: any) {
    console.error('Exception invoking account-approval function (approve):', error);
    return { success: false, error: `An unexpected error occurred: ${error.message}` };
  }
};

/**
 * Reject an account using the Supabase Edge Function
 */
export const rejectAccountViaEdgeFunction = async (userIdToReject: string) => {
  const supabase = await createClient();
  
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) {
    return { success: false, error: "You must be logged in to reject accounts." };
  }

  const activeOrgIdText = currentUser.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
      return { success: false, error: "No active organization selected or found in your session." };
  }

  try {
    const { data, error } = await supabase.functions.invoke('account-approval', {
      body: {
        action: 'reject',
        userIdToReject: userIdToReject,
        activeOrgId: activeOrgIdText, // Pass TEXT active_org_id
        actorUserId: currentUser.id
      }
    });

    if (error) {
      console.error('Error calling account-approval function (reject):', error);
      return { success: false, error: `Failed to reject account: ${error.message}` };
    }

    if (data && data.error) {
        console.error('Error from account-approval function (reject):', data.error);
        return { success: false, error: `Failed to reject account: ${data.error}` };
    }

    revalidatePath('/dashboard/users');
    
    return { success: true, message: "Account rejected successfully", data };
  } catch (error: any) {
    console.error('Exception invoking account-approval function (reject):', error);
    return { success: false, error: `An unexpected error occurred: ${error.message}` };
  }
};


/**
 * Process account approval action via Edge Function
 * This is a wrapper for the form action to handle both approve and reject
 */
export const processAccountApprovalViaEdgeFunction = async (formData: FormData) => {
  const userId = formData.get("userId")?.toString();
  const action = formData.get("action")?.toString(); // 'approve' or 'reject'

  if (!userId || !action || (action !== 'approve' && action !== 'reject')) {
    return encodedRedirect("error", "/dashboard/users", "Invalid request: User ID and action are required.");
  }

  try {
    let result;
    
    if (action === 'approve') {
      result = await approveAccountViaEdgeFunction(userId);
    } else { // action === 'reject'
      result = await rejectAccountViaEdgeFunction(userId);
    }

    if (!result.success) {
      return encodedRedirect("error", "/dashboard/users", result.error || "Failed to process request via Edge Function.");
    }

    return encodedRedirect("success", "/dashboard/users", `User ${action}d successfully via Edge Function.`);
  } catch (error: any) {
    console.error(`Error processing account ${action} via Edge Function:`, error);
    return encodedRedirect("error", "/dashboard/users", "An unexpected error occurred while processing the request.");
  }
};