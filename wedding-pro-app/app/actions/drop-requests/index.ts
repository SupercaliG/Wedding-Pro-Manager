"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Import utility functions
import {
  checkCreateDropRequestPermission,
  checkEmployeeDropRequestsPermission,
  checkManagerDropRequestsPermission,
  checkAdminDropRequestsPermission,
  checkModifyDropRequestPermission,
  getEmployeeDropRequestsQuery,
  getManagerDropRequestsQuery,
  getAdminDropRequestsQuery,
  verifyJobOrganization
} from "./utils";

// Import notification functions
import {
  sendDropRequestCreatedNotification,
  sendDropRequestApprovedNotification,
  sendDropRequestRejectedNotification,
  sendDropRequestEscalatedNotification
} from "./notifications";

/**
 * Creates a new drop request for a job assignment
 */
export async function createDropRequest(jobAssignmentId: string, reason: string) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, error: permissionError } = await checkCreateDropRequestPermission();
    if (!authorized) {
      return { success: false, error: permissionError };
    }
    
    // Verify the job assignment belongs to the user
    const { data: jobAssignment, error: jobAssignmentError } = await supabase
      .from('job_assignments')
      .select('id, job_id')
      .eq('id', jobAssignmentId)
      .eq('user_id', user!.id)
      .single();
    
    if (jobAssignmentError || !jobAssignment) {
      return { success: false, error: "Job assignment not found or does not belong to you" };
    }
    
    // Check if there's already an active drop request for this job assignment
    const { data: existingRequests, error: existingRequestsError } = await supabase
      .from('drop_requests')
      .select('id, status')
      .eq('job_assignment_id', jobAssignmentId)
      .in('status', ['pending', 'escalated'])
      .limit(1);
    
    if (existingRequestsError) {
      return { success: false, error: "Failed to check for existing drop requests" };
    }
    
    if (existingRequests && existingRequests.length > 0) {
      return { success: false, error: "You already have an active drop request for this job" };
    }
    
    // Create the drop request
    const { data: dropRequest, error: dropRequestError } = await supabase
      .from('drop_requests')
      .insert({
        job_assignment_id: jobAssignmentId,
        user_id: user!.id,
        reason: reason,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (dropRequestError) {
      console.error("Error creating drop request:", dropRequestError);
      return { success: false, error: "Failed to create drop request" };
    }
    
    // Send notification to managers about the new drop request
    try {
      await sendDropRequestCreatedNotification(
        supabase,
        dropRequest.id,
        jobAssignmentId,
        user!.id
      );
    } catch (notificationError) {
      // Log notification error but don't fail the drop request creation
      console.error("Error sending drop request notification:", notificationError);
    }
    
    revalidatePath('/dashboard/employee/schedule');
    revalidatePath('/dashboard/manager/drop-requests');
    
    return { success: true, data: dropRequest };
  } catch (error) {
    console.error("Error in createDropRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Fetches drop requests made by the current employee
 */
export async function getDropRequestsForEmployee() {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, error: permissionError } = await checkEmployeeDropRequestsPermission();
    if (!authorized) {
      if (!user) {
        redirect("/sign-in");
      }
      return { data: [], error: permissionError };
    }
    
    // Get the employee's drop requests with job details
    const query = getEmployeeDropRequestsQuery(supabase, user!.id);
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching employee drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForEmployee:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}

/**
 * Fetches drop requests for a manager to review
 */
export async function getDropRequestsForManager(statusFilters: string[] = ['pending']) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, profile, error: permissionError } = await checkManagerDropRequestsPermission();
    if (!authorized) {
      return { data: [], error: permissionError };
    }
    
    // Get drop requests for jobs in the manager's organization
    const query = getManagerDropRequestsQuery(supabase, profile!.org_id!, statusFilters);
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching manager drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForManager:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}

/**
 * Fetches drop requests for an admin to review
 */
export async function getDropRequestsForAdmin(statusFilters: string[] = ['escalated']) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, profile, error: permissionError } = await checkAdminDropRequestsPermission();
    if (!authorized) {
      return { data: [], error: permissionError };
    }
    
    // Get drop requests based on admin's organization
    const query = getAdminDropRequestsQuery(supabase, profile!.org_id, statusFilters);
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching admin drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForAdmin:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}

/**
 * Approves a drop request
 */
export async function approveDropRequest(dropRequestId: string) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, profile, isManager, isAdmin, error: permissionError } = 
      await checkModifyDropRequestPermission();
    
    if (!authorized) {
      return { success: false, error: permissionError };
    }
    
    // Get the drop request with job assignment details
    const { data: dropRequest, error: dropRequestError } = await supabase
      .from('drop_requests')
      .select(`
        id,
        job_assignment_id,
        user_id,
        status,
        job_assignment:job_assignments (
          id,
          job_id,
          user_id
        )
      `)
      .eq('id', dropRequestId)
      .single();
    
    if (dropRequestError || !dropRequest) {
      return { success: false, error: "Drop request not found" };
    }
    
    // Check if the request is already resolved
    if (dropRequest.status === 'approved' || dropRequest.status === 'rejected') {
      return { success: false, error: "This drop request has already been resolved" };
    }
    
    // If user is a manager, they can only approve 'pending' requests
    // If user is an admin, they can approve 'pending' or 'escalated' requests
    if (isManager && !isAdmin && dropRequest.status === 'escalated') {
      return { success: false, error: "Managers cannot approve escalated drop requests" };
    }
    
    // Verify the job belongs to the user's organization
    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      dropRequest.job_assignment.job_id,
      profile!.org_id
    );
    
    if (!verified) {
      return { success: false, error: verificationError };
    }
    
    // Start a transaction to update multiple tables
    // 1. Update the drop request status
    // 2. Delete the job assignment
    // 3. Update the job status to indicate it needs to be reassigned
    
    // Update the drop request
    const { error: updateError } = await supabase
      .from('drop_requests')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: user!.id
      })
      .eq('id', dropRequestId);
    
    if (updateError) {
      console.error("Error updating drop request:", updateError);
      return { success: false, error: "Failed to update drop request status" };
    }
    
    // Delete the job assignment
    const { error: deleteError } = await supabase
      .from('job_assignments')
      .delete()
      .eq('id', dropRequest.job_assignment_id);
    
    if (deleteError) {
      console.error("Error deleting job assignment:", deleteError);
      return { success: false, error: "Failed to delete job assignment" };
    }
    
    // Update the job status to indicate it needs to be reassigned
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'open' // or whatever status indicates it needs to be reassigned
      })
      .eq('id', dropRequest.job_assignment.job_id);
    
    if (jobUpdateError) {
      console.error("Error updating job status:", jobUpdateError);
      return { success: false, error: "Failed to update job status" };
    }
    
    // Get job details for notification
    const { data: job } = await supabase
      .from('jobs')
      .select('title, start_time')
      .eq('id', dropRequest.job_assignment.job_id)
      .single();
    
    // Send notification to employee about their drop request being approved
    if (job) {
      try {
        await sendDropRequestApprovedNotification(
          supabase,
          dropRequestId,
          dropRequest.user_id,
          dropRequest.job_assignment.job_id,
          job.title,
          job.start_time
        );
      } catch (notificationError) {
        console.error("Error sending approval notification:", notificationError);
      }
    }
    
    revalidatePath('/dashboard/employee/schedule');
    revalidatePath('/dashboard/manager/drop-requests');
    revalidatePath('/dashboard/manager/jobs');
    
    return { success: true };
  } catch (error) {
    console.error("Error in approveDropRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Rejects a drop request
 */
export async function rejectDropRequest(dropRequestId: string, rejectionReason: string) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, profile, isManager, isAdmin, error: permissionError } = 
      await checkModifyDropRequestPermission();
    
    if (!authorized) {
      return { success: false, error: permissionError };
    }
    
    // Get the drop request with job assignment details
    const { data: dropRequest, error: dropRequestError } = await supabase
      .from('drop_requests')
      .select(`
        id,
        job_assignment_id,
        user_id,
        status,
        job_assignment:job_assignments (
          id,
          job_id
        )
      `)
      .eq('id', dropRequestId)
      .single();
    
    if (dropRequestError || !dropRequest) {
      return { success: false, error: "Drop request not found" };
    }
    
    // Check if the request is already resolved
    if (dropRequest.status === 'approved' || dropRequest.status === 'rejected') {
      return { success: false, error: "This drop request has already been resolved" };
    }
    
    // If user is a manager, they can only reject 'pending' requests
    // If user is an admin, they can reject 'pending' or 'escalated' requests
    if (isManager && !isAdmin && dropRequest.status === 'escalated') {
      return { success: false, error: "Managers cannot reject escalated drop requests" };
    }
    
    // Verify the job belongs to the user's organization
    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      dropRequest.job_assignment.job_id,
      profile!.org_id
    );
    
    if (!verified) {
      return { success: false, error: verificationError };
    }
    
    // Update the drop request
    const { error: updateError } = await supabase
      .from('drop_requests')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: user!.id,
        rejection_reason: rejectionReason
      })
      .eq('id', dropRequestId);
    
    if (updateError) {
      console.error("Error updating drop request:", updateError);
      return { success: false, error: "Failed to update drop request status" };
    }
    
    // Get job details for notification
    const { data: job } = await supabase
      .from('jobs')
      .select('title, start_time')
      .eq('id', dropRequest.job_assignment.job_id)
      .single();
    
    // Send notification to employee about their drop request being rejected
    if (job) {
      try {
        await sendDropRequestRejectedNotification(
          supabase,
          dropRequestId,
          dropRequest.user_id,
          dropRequest.job_assignment.job_id,
          job.title,
          job.start_time,
          rejectionReason
        );
      } catch (notificationError) {
        console.error("Error sending rejection notification:", notificationError);
      }
    }
    
    revalidatePath('/dashboard/employee/schedule');
    revalidatePath('/dashboard/manager/drop-requests');
    
    return { success: true };
  } catch (error) {
    console.error("Error in rejectDropRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Escalates a drop request
 */
export async function escalateDropRequest(dropRequestId: string, escalationReason: string) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, profile, error: permissionError } = 
      await checkModifyDropRequestPermission();
    
    if (!authorized) {
      return { success: false, error: permissionError };
    }
    
    // Get the drop request with job assignment details
    const { data: dropRequest, error: dropRequestError } = await supabase
      .from('drop_requests')
      .select(`
        id,
        job_assignment_id,
        user_id,
        status,
        job_assignment:job_assignments (
          id,
          job_id
        )
      `)
      .eq('id', dropRequestId)
      .single();
    
    if (dropRequestError || !dropRequest) {
      return { success: false, error: "Drop request not found" };
    }
    
    // Check if the request is already resolved or escalated
    if (dropRequest.status === 'approved' || dropRequest.status === 'rejected' || dropRequest.status === 'escalated') {
      return { success: false, error: `This drop request is already ${dropRequest.status}` };
    }
    
    // Verify the job belongs to the user's organization
    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      dropRequest.job_assignment.job_id,
      profile!.org_id
    );
    
    if (!verified) {
      return { success: false, error: verificationError };
    }
    
    // Update the drop request
    const { error: updateError } = await supabase
      .from('drop_requests')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        escalated_by_user_id: user!.id,
        escalation_reason: escalationReason
      })
      .eq('id', dropRequestId);
    
    if (updateError) {
      console.error("Error updating drop request:", updateError);
      return { success: false, error: "Failed to update drop request status" };
    }
    
    // Get job details for notification
    const { data: job } = await supabase
      .from('jobs')
      .select('title, start_time')
      .eq('id', dropRequest.job_assignment.job_id)
      .single();
    
    // Get employee details for notification
    const { data: employee } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', dropRequest.user_id)
      .single();
    
    // Send notification to admins about the escalated drop request
    if (job) {
      try {
        await sendDropRequestEscalatedNotification(
          supabase,
          dropRequestId,
          dropRequest.job_assignment.job_id,
          job.title,
          job.start_time,
          dropRequest.user_id,
          employee?.full_name || 'Unknown Employee',
          escalationReason,
          profile!.org_id!
        );
      } catch (notificationError) {
        console.error("Error sending escalation notification:", notificationError);
      }
    }
    
    revalidatePath('/dashboard/manager/drop-requests');
    revalidatePath('/dashboard/admin/drop-requests');
    
    return { success: true };
  } catch (error) {
    console.error("Error in escalateDropRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Re-export the original file's functions to maintain backward compatibility
export * from "./utils";