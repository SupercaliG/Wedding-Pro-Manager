"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/utils";
import { SupabaseClient } from "@supabase/supabase-js";
import { createNotificationService } from "@/utils/notifications/notification-service";

import {
  JobData,
  JobWithVenue,
  calculateTravelPay,
  getEmployeeAddress,
  calculateDistance,
  parseDistanceRange,
  hasTimeConflict,
  checkManagerPermission,
  verifyJobOrganization
} from "./utils";

import {
  sendJobCompletedNotifications,
  sendJobCreatedNotifications,
  sendJobUpdatedNotifications
} from "./notifications";

/**
 * Create a new job
 */
export async function createJob(formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error } = await checkManagerPermission();
  if (!authorized) {
    return encodedRedirect("error", "/sign-in", error || "Unauthorized");
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
      "/dashboard/manager/jobs/new",
      "Title, start time, end time, venue, and status are required"
    );
  }
  
  try {
    // Calculate travel pay if offered
    let travelPayAmount = null;
    if (travelPayOffered) {
      travelPayAmount = await calculateTravelPay(profile!.org_id!, venueId);
    }
    
    // Insert job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert([
        {
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          venue_id: venueId,
          status,
          travel_pay_offered: travelPayOffered,
          travel_pay_amount: travelPayAmount,
          created_by_user_id: user!.id,
          org_id: profile!.org_id
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error("Error creating job:", error);
      return encodedRedirect("error", "/dashboard/manager/jobs/new", error.message);
    }
    
    // Send notifications for the new job
    await sendJobCreatedNotifications(supabase, job.id, user!.id);
    
    revalidatePath('/dashboard/manager/jobs');
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job created successfully");
  } catch (error) {
    console.error("Error creating job:", error);
    return encodedRedirect("error", "/dashboard/manager/jobs/new", "An unexpected error occurred");
  }
}

/**
 * Get jobs by organization
 */
export async function getJobsByOrg(status?: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Build query
  let query = supabase
    .from('jobs')
    .select(`
      *,
      venue:venue_id (
        id, name, address, city, state, zip
      )
    `)
    .eq('org_id', profile.org_id);
  
  // Add status filter if provided
  if (status) {
    query = query.eq('status', status);
  }
  
  // Execute query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching jobs:", error);
    return { error: "Failed to fetch jobs" };
  }
  
  return { data: data as unknown as JobWithVenue[] };
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { error: "Profile not found" };
  }
  
  // Build query
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      title,
      description,
      start_time,
      end_time,
      venue_id,
      status,
      travel_pay_offered,
      travel_pay_amount,
      created_by_user_id,
      org_id,
      created_at,
      completed_at,
      first_assigned_at,
      time_to_fill_duration,
      assignment_to_completion_duration,
      venue:venue_id (
        id, name, address, city, state, zip
      )
    `)
    .eq('id', jobId)
    .single();
  
  if (error) {
    console.error("Error fetching job:", error);
    return { error: "Failed to fetch job" };
  }
  
  // Check if user has access to this job
  if (profile.role !== 'Admin' && data.org_id !== profile.org_id) {
    return { error: "You don't have access to this job" };
  }
  
  return { data: data as JobWithVenue };
}

/**
 * Update job
 */
export async function updateJob(jobId: string, formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error } = await checkManagerPermission();
  if (!authorized) {
    return encodedRedirect("error", "/sign-in", error || "Unauthorized");
  }
  
  // Verify the job belongs to the user's organization
  const { verified, error: jobError } = await verifyJobOrganization(
    supabase,
    jobId,
    profile!.org_id!
  );
  
  if (!verified) {
    return encodedRedirect("error", `/dashboard/manager/jobs`, jobError || "Job not found");
  }
  
  // Get the job to check venue_id for travel pay calculation
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('venue_id')
    .eq('id', jobId)
    .single();
  
  if (fetchError) {
    return encodedRedirect("error", `/dashboard/manager/jobs`, "Error fetching job details");
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
    
    // Calculate travel pay if offered and venue changed
    if (travelPayOffered && (venueId !== job.venue_id || !job.venue_id)) {
      const travelPayAmount = await calculateTravelPay(profile!.org_id!, venueId);
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
    await sendJobUpdatedNotifications(supabase, jobId, user!.id);
    
    revalidatePath('/dashboard/manager/jobs');
    revalidatePath(`/dashboard/manager/jobs/${jobId}`);
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job updated successfully");
  } catch (error) {
    console.error("Error updating job:", error);
    return encodedRedirect("error", `/dashboard/manager/jobs/${jobId}/edit`, "An unexpected error occurred");
  }
}

/**
 * Delete job
 */
export async function deleteJob(formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, profile, error } = await checkManagerPermission();
  if (!authorized) {
    return encodedRedirect("error", "/sign-in", error || "Unauthorized");
  }
  
  // Extract job ID
  const jobId = formData.get("jobId")?.toString();
  if (!jobId) {
    return encodedRedirect("error", "/dashboard/manager/jobs", "Job ID is required");
  }
  
  // Verify the job belongs to the user's organization
  const { verified, error: jobError } = await verifyJobOrganization(
    supabase,
    jobId,
    profile!.org_id!
  );
  
  if (!verified) {
    return encodedRedirect("error", "/dashboard/manager/jobs", jobError || "Job not found");
  }
  
  try {
    // Fetch job details before deletion
    const { data: job, error: jobFetchError } = await supabase
      .from('jobs')
      .select('id, title, org_id')
      .eq('id', jobId)
      .single();

    if (jobFetchError || !job) {
      console.error("Error fetching job for deletion notification:", jobFetchError);
    } else {
      // Fetch employees assigned to this job
      const { data: assignments, error: assignmentError } = await supabase
        .from('job_assignments')
        .select('user_id')
        .eq('job_id', jobId);

      if (assignmentError) {
        console.error("Error fetching job assignments for deletion notification:", assignmentError);
      }

      // Fetch managers in the organization
      const { data: managers, error: managerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', job.org_id)
        .eq('role', 'Manager');

      if (managerError) {
        console.error("Error fetching managers for deletion notification:", managerError);
      }

      // Send notifications to assigned employees
      const notificationService = createNotificationService(supabase);
      const recipients = [
        ...(assignments?.map(a => a.user_id) || []),
        ...(managers?.map(m => m.id) || [])
      ];

      for (const userId of recipients) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'org_announcement',
            userId,
            title: 'Job Deleted',
            body: `The job "${job.title}" has been deleted and is no longer available.`,
            metadata: {
              jobId: job.id,
              deletedAt: new Date().toISOString()
            }
          });
        } catch (notifyError) {
          console.error(`Error sending job deletion notification to user ${userId}:`, notifyError);
        }
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
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job deleted successfully");
  } catch (error) {
    console.error("Error deleting job:", error);
    return encodedRedirect("error", "/dashboard/manager/jobs", "An unexpected error occurred");
  }
}

/**
 * Get available jobs for an employee with filtering options
 */
export async function getAvailableJobsForEmployee(
  filters?: {
    role?: string;
    distance?: string;
    status?: string;
  }
) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Build query
  let query = supabase
    .from('jobs')
    .select(`
      *,
      venue:venue_id (
        id, name, address, city, state, zip
      ),
      job_required_roles (
        id, role_name
      )
    `)
    .eq('org_id', profile.org_id)
    .in('status', ['available', 'pending', 'open'])
    .order('start_time', { ascending: true });
  
  // Apply role filter if provided
  if (filters?.role) {
    query = query.filter('job_required_roles.role_name', 'eq', filters.role);
  }
  
  // Apply status filter if provided
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  // Execute query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching available jobs:", error);
    return { error: "Failed to fetch available jobs" };
  }
  
  // If distance filter is provided, we need to filter the results after fetching
  // because we need to calculate the distance for each job
  let filteredData = data;
  if (filters?.distance && data) {
    // Get the employee's address or organization's address
    const employeeAddress = await getEmployeeAddress(profile.id, profile.org_id);
    if (!employeeAddress) {
      return { error: "Failed to get address for distance calculation" };
    }
    
    // Calculate distance for each job and filter based on the distance range
    const distanceRange = parseDistanceRange(filters.distance);
    if (distanceRange) {
      const jobsWithDistance = await Promise.all(
        data.map(async (job) => {
          const venue = job.venue;
          if (!venue) return { ...job, distance: null };
          
          const venueAddress = `${venue.address}, ${venue.city}, ${venue.state} ${venue.zip}`;
          const distance = await calculateDistance(employeeAddress, venueAddress);
          
          return { ...job, distance };
        })
      );
      
      filteredData = jobsWithDistance.filter(job => {
        if (job.distance === null) return true;
        
        const { min, max } = distanceRange;
        if (min !== null && job.distance < min) return false;
        if (max !== null && job.distance > max) return false;
        
        return true;
      });
    }
  }
  
  return { data: filteredData };
}

/**
 * Get employee's current and future job assignments
 */
export async function getEmployeeAssignments(employeeId?: string) {
  const supabase = await createClient();
  
  // Get current user if employeeId is not provided
  let userId = employeeId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "You must be logged in" };
    }
    userId = user.id;
  }
  
  // Get current date
  const now = new Date();
  const isoDate = now.toISOString();
  
  // Get assignments
  const { data, error } = await supabase
    .from('job_assignments')
    .select(`
      id,
      job_id,
      employee_id,
      status,
      jobs (
        id,
        title,
        start_time,
        end_time,
        venue_id,
        venue:venue_id (
          id, name, address, city, state, zip
        )
      )
    `)
    .eq('employee_id', userId)
    .gte('jobs.start_time', isoDate)
    .order('jobs.start_time', { ascending: true });
  
  if (error) {
    console.error("Error fetching employee assignments:", error);
    return { error: "Failed to fetch employee assignments" };
  }
  
  return { data };
}

/**
 * Mark a job as complete and calculate analytics metrics
 */
export async function markJobAsComplete(jobId: string) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error } = await checkManagerPermission();
  if (!authorized) {
    return { success: false, error: error || "Unauthorized" };
  }
  
  try {
    // Verify the job belongs to the user's organization
    const { verified, error: jobError, job } = await verifyJobOrganization(
      supabase,
      jobId,
      profile!.org_id!
    );
    
    if (!verified) {
      return { success: false, error: jobError || "Job not found" };
    }
    
    // Get job details for analytics
    const { data: jobDetails, error: detailsError } = await supabase
      .from('jobs')
      .select('created_at, first_assigned_at')
      .eq('id', jobId)
      .single();
    
    if (detailsError) {
      console.error("Error fetching job details:", detailsError);
      return { success: false, error: "Failed to fetch job details" };
    }
    
    const now = new Date().toISOString();
    
    // Calculate analytics KPIs
    let updateData: any = {
      status: 'completed',
      completed_at: now
    };
    
    // Calculate time_to_fill_duration if first_assigned_at is not null
    if (jobDetails.first_assigned_at) {
      // For PostgreSQL interval calculation, we need to use proper syntax
      // Calculate time from job creation to first assignment
      updateData.time_to_fill_duration = `${jobDetails.first_assigned_at}::timestamptz - ${jobDetails.created_at}::timestamptz`;
      
      // Calculate time from first assignment to completion
      updateData.assignment_to_completion_duration = `${now}::timestamptz - ${jobDetails.first_assigned_at}::timestamptz`;
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
          user_id: user!.id,
          org_id: profile!.org_id!,
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
    await sendJobCompletedNotifications(supabase, jobId, user!.id, now);
    
    revalidatePath('/dashboard/manager/jobs');
    revalidatePath(`/dashboard/manager/jobs/${jobId}`);
    return { success: true, message: "Job marked as complete successfully" };
  } catch (error) {
    console.error("Error marking job as complete:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Re-export types from utils
export type { JobData, JobWithVenue };