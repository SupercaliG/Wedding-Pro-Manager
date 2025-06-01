"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { revalidatePath } from "next/cache";
import { hasTimeConflict } from "../utils/timeUtils";
import { createNotificationService } from "@/utils/notifications/notification-service";

/**
 * Express interest in a job
 * @param jobId The ID of the job to express interest in
 * @returns Object with success status and message
 */
export async function expressInterest(jobId: string) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be logged in" };
  }
  
  // Get user profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, message: "Profile not found" };
  }
  
  try {
    // Get the job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        venue:venue_id (
          id, name, address, city, state, zip
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job:", jobError);
      return { success: false, message: "Job not found" };
    }
    
    // Get user's existing assignments to check for time conflicts
    const { data: assignments, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        id,
        job_id,
        jobs (
          start_time,
          end_time
        )
      `)
      .eq('user_id', user.id);
    
    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      return { success: false, message: "Failed to check for time conflicts" };
    }
    
    // Format assignments for time conflict check
    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      job_id: assignment.job_id,
      start_time: assignment.jobs?.[0]?.start_time || '',
      end_time: assignment.jobs?.[0]?.end_time || ''
    }));
    
    // Check for time conflicts
    // Check for time conflicts with all assignments
    const jobStart = job.start_time;
    const jobEnd = job.end_time;
    const conflict = formattedAssignments.some(a =>
      hasTimeConflict(jobStart, jobEnd, a.start_time, a.end_time)
    );
    if (conflict) {
      return { success: false, message: "You have a time conflict with this job" };
    }
    
    // Check if interest already exists
    const { data: existingInterest, error: interestError } = await supabase
      .from('job_interests')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (interestError) {
      console.error("Error checking existing interest:", interestError);
      return { success: false, message: "Failed to check existing interest" };
    }
    
    if (existingInterest) {
      return { success: false, message: "You have already expressed interest in this job" };
    }
    
    // Insert interest
    const { error: insertError } = await supabase
      .from('job_interests')
      .insert([
        {
          job_id: jobId,
          user_id: user.id,
          expressed_at: new Date().toISOString()
        }
      ]);
    
    if (insertError) {
      console.error("Error expressing interest:", insertError);
      return { success: false, message: insertError.message };
    }
    
    // Send notification to managers about the new job interest
    try {
      // Get job details for the notification
      const { data: jobDetails } = await supabase
        .from('jobs')
        .select('title, org_id')
        .eq('id', jobId)
        .single();
      
      if (jobDetails) {
        // Get employee profile to get their name
        const { data: employeeProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        // Get managers for this organization
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', jobDetails.org_id)
          .eq('role', 'manager');
        
        if (managers && managers.length > 0) {
          const notificationService = createNotificationService(supabase);
          
          // Format job details
          const jobTitle = jobDetails.title || 'Untitled Job';
          const employeeName = employeeProfile?.full_name || 'An employee';
          
          // Send notification to each manager
          for (const manager of managers) {
            await notificationService.sendNotificationForEvent({
              eventType: 'job_interest_expressed',
              userId: manager.id,
              title: 'New Job Interest',
              body: `${employeeName} has expressed interest in the job "${jobTitle}".`,
              metadata: {
                jobId,
                employeeId: user.id,
                employeeName: employeeProfile?.full_name,
                jobTitle: jobDetails.title,
                expressedAt: new Date().toISOString()
              }
            });
          }
        }
      }
    } catch (notificationError) {
      // Log notification error but don't fail the job interest expression
      console.error("Error sending job interest notification:", notificationError);
    }
    
    revalidatePath('/dashboard/employee/available-jobs');
    return { success: true, message: "Interest expressed successfully" };
  } catch (error) {
    console.error("Error expressing interest:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Withdraw interest from a job
 * @param jobId The ID of the job to withdraw interest from
 * @returns Object with success status and message
 */
export async function withdrawInterest(jobId: string) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be logged in" };
  }
  
  try {
    // Get job details before deleting interest (for notification)
    const { data: jobDetails } = await supabase
      .from('jobs')
      .select('title, org_id')
      .eq('id', jobId)
      .single();
    
    // Get employee profile
    const { data: employeeProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    // Delete interest
    const { error } = await supabase
      .from('job_interests')
      .delete()
      .eq('job_id', jobId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error("Error withdrawing interest:", error);
      return { success: false, message: error.message };
    }
    
    // Send notification to managers about the withdrawn job interest
    try {
      if (jobDetails) {
        // Get managers for this organization
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', jobDetails.org_id)
          .eq('role', 'manager');
        
        if (managers && managers.length > 0) {
          const notificationService = createNotificationService(supabase);
          
          // Format job details
          const jobTitle = jobDetails.title || 'Untitled Job';
          const employeeName = employeeProfile?.full_name || 'An employee';
          
          // Send notification to each manager
          for (const manager of managers) {
            await notificationService.sendNotificationForEvent({
              eventType: 'job_interest_withdrawn',
              userId: manager.id,
              title: 'Job Interest Withdrawn',
              body: `${employeeName} has withdrawn their interest in the job "${jobTitle}".`,
              metadata: {
                jobId,
                employeeId: user.id,
                employeeName: employeeProfile?.full_name,
                jobTitle: jobDetails.title,
                withdrawnAt: new Date().toISOString()
              }
            });
          }
        }
      }
    } catch (notificationError) {
      // Log notification error but don't fail the job interest withdrawal
      console.error("Error sending job interest withdrawal notification:", notificationError);
    }
    
    revalidatePath('/dashboard/employee/available-jobs');
    return { success: true, message: "Interest withdrawn successfully" };
  } catch (error) {
    console.error("Error withdrawing interest:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

/**
 * Get the jobs that the current user has expressed interest in
 * @returns Array of job IDs
 */
export async function getUserJobInterests() {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: [], error: "You must be logged in" };
  }
  
  try {
    // Get interests
    const { data, error } = await supabase
      .from('job_interests')
      .select('job_id')
      .eq('user_id', user.id);
    
    if (error) {
      console.error("Error fetching job interests:", error);
      return { data: [], error: "Failed to fetch job interests" };
    }
    
    // Extract job IDs
    const jobIds = data.map(interest => interest.job_id);
    
    return { data: jobIds, error: null };
  } catch (error) {
    console.error("Error fetching job interests:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}