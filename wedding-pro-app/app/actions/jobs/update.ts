"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers"; // Added for profile access if needed
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation"; // Added as it's used in original index.ts
import { encodedRedirect } from "@/utils/utils";
import { SupabaseClient } from "@supabase/supabase-js"; // Added as it's used in original index.ts
import { createNotificationService } from "@/utils/notifications/notification-service";

import {
  calculateTravelPay,
  checkManagerPermission,
  verifyJobOrganization
} from "./utils";
import type { JobData } from "./types";
import {
  sendJobCompletedNotifications,
  sendJobUpdatedNotifications
  // sendJobDeletedNotifications might be needed if we create it
} from "./notifications";

/**
 * Update job
 */
export async function updateJob(jobId: string, formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error: permError } = await checkManagerPermission();
  if (!authorized || !user || !profile) { // Ensure user and profile are available
    return encodedRedirect("error", "/sign-in", permError || "Unauthorized or profile missing");
  }
  
  // Verify the job belongs to the user's organization
  const { verified, error: jobVerifyError } = await verifyJobOrganization( // Renamed 'error'
    supabase,
    jobId,
    profile.org_id!
  );
  
  if (!verified) {
    return encodedRedirect("error", `/dashboard/manager/jobs`, jobVerifyError || "Job not found or not authorized");
  }
  
  // Get the job to check venue_id for travel pay calculation
  const { data: currentJob, error: fetchError } = await supabase // Renamed 'job' to 'currentJob'
    .from('jobs')
    .select('venue_id, travel_pay_offered') // Added travel_pay_offered to check if it changed
    .eq('id', jobId)
    .single();
  
  if (fetchError || !currentJob) {
    return encodedRedirect("error", `/dashboard/manager/jobs`, "Error fetching job details for update");
  }
  
  // Extract form data
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString();
  const startTime = formData.get("start_time")?.toString();
  const endTime = formData.get("end_time")?.toString();
  const venueId = formData.get("venue_id")?.toString();
  const status = formData.get("status")?.toString() as JobData['status'];
  const travelPayOffered = formData.get("travel_pay_offered") === "on";
  
  // Validate required fields
  if (!title || !startTime || !endTime || !venueId || !status) {
    return encodedRedirect(
      "error",
      `/dashboard/manager/jobs/${jobId}/edit`,
      "Title, start time, end time, venue, and status are required"
    );
  }
  
  try {
    // Prepare update data
    const updateData: Partial<JobData> = {
      title,
      description,
      start_time: startTime,
      end_time: endTime,
      venue_id: venueId,
      status,
      travel_pay_offered: travelPayOffered,
    };
    
    // Calculate travel pay if offered and (venue changed OR travel_pay_offered status changed to true)
    if (travelPayOffered && (venueId !== currentJob.venue_id || !currentJob.travel_pay_offered)) {
      const travelPayAmount = await calculateTravelPay(profile.org_id!, venueId);
      updateData.travel_pay_amount = travelPayAmount;
    } else if (!travelPayOffered) {
      updateData.travel_pay_amount = null;
    }
    
    // Update job
    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);
    
    if (error) {
      console.error("Error updating job:", error);
      return encodedRedirect("error", `/dashboard/manager/jobs/${jobId}/edit`, error.message);
    }
    
    // Send notifications about the job update
    await sendJobUpdatedNotifications(supabase, jobId, user.id);
    
    revalidatePath('/dashboard/manager/jobs');
    revalidatePath(`/dashboard/manager/jobs/${jobId}`);
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job updated successfully");
  } catch (error) {
    console.error("Error updating job:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return encodedRedirect("error", `/dashboard/manager/jobs/${jobId}/edit`, errorMessage);
  }
}

/**
 * Delete job
 */
export async function deleteJob(formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error: permError } = await checkManagerPermission();
  if (!authorized || !user || !profile) { // Ensure user and profile are available
    return encodedRedirect("error", "/sign-in", permError || "Unauthorized or profile missing");
  }
  
  // Extract job ID
  const jobId = formData.get("jobId")?.toString();
  if (!jobId) {
    return encodedRedirect("error", "/dashboard/manager/jobs", "Job ID is required");
  }
  
  // Verify the job belongs to the user's organization
  const { verified, error: jobVerifyError, job: jobDetailsForNotification } = await verifyJobOrganization( // Renamed 'error', get job details
    supabase,
    jobId,
    profile.org_id!
  );
  
  if (!verified || !jobDetailsForNotification) { // Check jobDetailsForNotification as well
    return encodedRedirect("error", "/dashboard/manager/jobs", jobVerifyError || "Job not found or not authorized");
  }
  
  try {
    // Fetch employees assigned to this job
    const { data: assignments, error: assignmentError } = await supabase
      .from('job_assignments')
      .select('user_id')
      .eq('job_id', jobId);

    if (assignmentError) {
      console.error("Error fetching job assignments for deletion notification:", assignmentError);
      // Potentially continue without sending notifications to assignees or return error
    }

    // Fetch managers in the organization
    const { data: managers, error: managerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', jobDetailsForNotification.org_id) // Use org_id from fetched job
      .eq('role', 'Manager');

    if (managerError) {
      console.error("Error fetching managers for deletion notification:", managerError);
      // Potentially continue or return error
    }

    // Send notifications
    const notificationService = createNotificationService(supabase);
    const recipientUserIds = new Set<string>();
    if (assignments) {
      assignments.forEach(a => recipientUserIds.add(a.user_id));
    }
    if (managers) {
      managers.forEach(m => recipientUserIds.add(m.id));
    }
    // Ensure the user performing the delete doesn't get notified about their own action, unless intended
    // recipientUserIds.delete(user.id); 

    for (const recipientUserId of Array.from(recipientUserIds)) {
      try {
        await notificationService.sendNotificationForEvent({
          eventType: 'org_announcement', // Or a more specific 'job_deleted' type if available/preferred
          userId: recipientUserId,
          title: 'Job Deleted',
          body: `The job "${jobDetailsForNotification.title}" has been deleted and is no longer available.`,
          metadata: {
            jobId: jobDetailsForNotification.id,
            deletedBy: user.id,
            deletedAt: new Date().toISOString()
          }
        });
      } catch (notifyError) {
        console.error(`Error sending job deletion notification to user ${recipientUserId}:`, notifyError);
      }
    }
    
    // Delete job
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);
    
    if (error) {
      console.error("Error deleting job:", error);
      return encodedRedirect("error", "/dashboard/manager/jobs", error.message);
    }
    
    revalidatePath('/dashboard/manager/jobs');
    revalidatePath(`/dashboard/manager/jobs/${jobId}`); // Revalidate specific job page too
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job deleted successfully");
  } catch (error) {
    console.error("Error deleting job:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return encodedRedirect("error", "/dashboard/manager/jobs", errorMessage);
  }
}

/**
 * Mark a job as complete and calculate analytics metrics
 */
export async function markJobAsComplete(jobId: string) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error: permError } = await checkManagerPermission();
  if (!authorized || !user || !profile) { // Ensure user and profile are available
    return { success: false, error: permError || "Unauthorized or profile missing" };
  }
  
  try {
    // Verify the job belongs to the user's organization
    const { verified, error: jobVerifyError, job } = await verifyJobOrganization( // Renamed 'error'
      supabase,
      jobId,
      profile.org_id!
    );
    
    if (!verified || !job) { // Check job as well
      return { success: false, error: jobVerifyError || "Job not found or not authorized" };
    }
    
    // Get job details for analytics (already fetched by verifyJobOrganization if select was broad enough)
    // If verifyJobOrganization doesn't return all needed fields, fetch them here.
    // For now, assume 'job' from verifyJobOrganization has created_at and first_assigned_at
    const jobDetails = job; 
    
    const now = new Date().toISOString();
    
    // Prepare update data
    let updateData: Partial<JobData> & { time_to_fill_duration?: string; assignment_to_completion_duration?: string } = {
      status: 'completed',
      completed_at: now
    };
    
    // Calculate time_to_fill_duration if first_assigned_at is not null
    if (jobDetails.first_assigned_at && jobDetails.created_at) {
      // For PostgreSQL interval calculation, we need to use proper syntax
      // Calculate time from job creation to first assignment
      // Ensure these are valid ISO strings
      const firstAssignedAt = new Date(jobDetails.first_assigned_at).toISOString();
      const createdAt = new Date(jobDetails.created_at).toISOString();

      updateData.time_to_fill_duration = `${firstAssignedAt}::timestamptz - ${createdAt}::timestamptz`;
      
      // Calculate time from first assignment to completion
      updateData.assignment_to_completion_duration = `${now}::timestamptz - ${firstAssignedAt}::timestamptz`;
    }
    
    // Update job
    const { error: updateError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);
    
    if (updateError) {
      console.error("Error marking job as complete:", updateError);
      return { success: false, error: updateError.message };
    }
    
    // Log to audit_logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: user.id,
          org_id: profile.org_id!,
          action: 'job_completed',
          details: {
            jobId,
            completed_at: now,
            time_to_fill_duration: updateData.time_to_fill_duration,
            assignment_to_completion_duration: updateData.assignment_to_completion_duration
          }
        }
      ]);
    
    if (auditError) {
      console.error("Error logging to audit_logs:", auditError);
      // Continue even if audit logging fails
    }
    
    // Send notifications to assigned employees and admins
    await sendJobCompletedNotifications(supabase, jobId, user.id, now);
    
    revalidatePath('/dashboard/manager/jobs');
    revalidatePath(`/dashboard/manager/jobs/${jobId}`);
    return { success: true, message: "Job marked as complete successfully" };
  } catch (error) {
    console.error("Error marking job as complete:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: errorMessage };
  }
}