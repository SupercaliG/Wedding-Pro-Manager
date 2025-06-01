"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Import utility functions
import {
  checkModifyDropRequestPermission,
  verifyJobOrganization
} from "./utils";

// Import notification functions
import {
  sendDropRequestApprovedNotification,
  sendDropRequestRejectedNotification,
  sendDropRequestEscalatedNotification
} from "./notifications";

// Import helper functions
import { getJobIdFromDropRequestAssignment } from "./_helpers";

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
    const jobIdForVerification = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);

    if (!jobIdForVerification) {
      return { success: false, error: "Associated job ID not found for verification." };
    }

    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      jobIdForVerification, 
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
      .eq(
        'id',
        (() => {
          const id = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
          if (!id) throw new Error("Job ID is missing for job status update.");
          return id;
        })()
      );
    
    if (jobUpdateError) {
      console.error("Error updating job status:", jobUpdateError);
      return { success: false, error: "Failed to update job status" };
    }
    
    // Get job details for notification
    const { data: job } = await supabase
      .from('jobs')
      .select('title, start_time')
      .eq(
        'id',
        (() => {
          const id = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
          if (!id) throw new Error("Job ID is missing for fetching job details.");
          return id;
        })()
      )
      .single();
    
    // Send notification to employee about their drop request being approved
    if (job) {
      const notificationJobId = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
      if (notificationJobId) {
        try {
          await sendDropRequestApprovedNotification(
            supabase,
            dropRequestId,
            dropRequest.user_id,
            notificationJobId,
            job.title,
            job.start_time
          );
        } catch (notificationError) {
          console.error("Error sending approval notification:", notificationError);
        }
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
    const jobIdForRejectVerification = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
    if (!jobIdForRejectVerification) {
      return { success: false, error: "Associated job ID not found for verification in reject." };
    }
    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      jobIdForRejectVerification,
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
      .eq(
        'id',
        (() => {
          const id = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
          if (!id) throw new Error("Job ID is missing for fetching job details in reject.");
          return id;
        })()
      )
      .single();
    
    // Send notification to employee about their drop request being rejected
    if (job) {
      const notificationJobId = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
      if (notificationJobId) {
        try {
          await sendDropRequestRejectedNotification(
            supabase,
            dropRequestId,
            dropRequest.user_id,
            notificationJobId,
            job.title,
            job.start_time,
            rejectionReason
          );
        } catch (notificationError) {
          console.error("Error sending rejection notification:", notificationError);
        }
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
    const jobIdForEscalateVerification = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
    if (!jobIdForEscalateVerification) {
      return { success: false, error: "Associated job ID not found for verification in escalate." };
    }
    const { verified, error: verificationError } = await verifyJobOrganization(
      supabase,
      jobIdForEscalateVerification,
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
      .eq(
        'id',
        (() => {
          const id = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
          if (!id) throw new Error("Job ID is missing for fetching job details in escalate.");
          return id;
        })()
      )
      .single();
    
    // Get employee details for notification
    const { data: employee } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', dropRequest.user_id)
      .single();
    
    // Send notification to admins about the escalated drop request
    if (job) {
      const notificationJobId = getJobIdFromDropRequestAssignment(dropRequest.job_assignment);
      if (notificationJobId) {
        try {
          await sendDropRequestEscalatedNotification(
            supabase,
            dropRequestId,
            notificationJobId,
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
    }
    
    revalidatePath('/dashboard/manager/drop-requests');
    revalidatePath('/dashboard/admin/drop-requests');
    
    return { success: true };
  } catch (error) {
    console.error("Error in escalateDropRequest:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}