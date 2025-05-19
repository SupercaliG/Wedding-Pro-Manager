"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { revalidatePath } from "next/cache";
import { hasTimeConflict } from "./job-actions";
import {
  getEmployeeAddress,
  calculateDistance,
  getLastAssignmentDate,
  sortEmployees,
  updateJobStatusIfAllRolesFilled
} from "@/utils/job-assignment-helpers";
import { createNotificationService, NotificationEventType } from "@/utils/notifications/notification-service";

/**
 * Sort options for interested employees
 */
export type SortOption = 
  | 'lastAssignmentDate_asc' 
  | 'lastAssignmentDate_desc' 
  | 'distance_asc' 
  | 'distance_desc' 
  | 'interestDate_asc' 
  | 'interestDate_desc';

/**
 * Interested employee with additional calculated fields
 */
export type InterestedEmployee = {
  id: string;
  user_id: string;
  job_id: string;
  expressed_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    role?: string;
  };
  distance?: number | null;
  last_assignment_date?: string | null;
};

/**
 * Get interested employees for a job with sorting options
 * @param jobId The ID of the job
 * @param sortOption The option to sort by
 * @returns Array of interested employees with calculated fields
 */
export async function getInterestedEmployeesForJob(
  jobId: string,
  sortOption: SortOption = 'interestDate_asc'
) {
  const supabase = await createClient();
  
  // Check if user is logged in and is a manager
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  const hasAccess = await isManager();
  if (!hasAccess) {
    return { error: "Only managers can view interested employees" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  try {
    // Get the job to verify ownership and get venue details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        org_id,
        venue_id,
        venue:venue_id (
          id, name, address, city, state, zip
        ),
        job_required_roles (
          id, role_name, quantity_needed
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job:", jobError);
      return { error: "Job not found" };
    }
    
    // Verify the job belongs to the user's organization
    if (job.org_id !== profile.org_id) {
      return { error: "You can only view interested employees for jobs in your organization" };
    }
    
    // Get interested employees with their profiles
    const { data: interestedEmployees, error: interestError } = await supabase
      .from('job_interests')
      .select(`
        id,
        user_id,
        job_id,
        expressed_at,
        profile:user_id (
          id, full_name, email, address, city, state, zip, role
        )
      `)
      .eq('job_id', jobId);
    
    if (interestError) {
      console.error("Error fetching interested employees:", interestError);
      return { error: "Failed to fetch interested employees" };
    }
    
    // Get current assignments for the job to check capacity
    const { data: currentAssignments, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        id,
        user_id,
        job_required_role_id,
        job_required_role:job_required_role_id (
          id, role_name
        )
      `)
      .eq('job_id', jobId);
    
    if (assignmentsError) {
      console.error("Error fetching current assignments:", assignmentsError);
      return { error: "Failed to fetch current assignments" };
    }
    
    // Calculate role capacity
    const roleCapacity = new Map();
    job.job_required_roles.forEach((role: any) => {
      roleCapacity.set(role.id, {
        role_name: role.role_name,
        quantity_needed: role.quantity_needed,
        assigned: 0
      });
    });
    
    // Count current assignments by role
    currentAssignments.forEach((assignment: any) => {
      if (roleCapacity.has(assignment.job_required_role_id)) {
        const role = roleCapacity.get(assignment.job_required_role_id);
        role.assigned += 1;
        roleCapacity.set(assignment.job_required_role_id, role);
      }
    });
    
    // Process each interested employee to add calculated fields
    const processedEmployees = await Promise.all(
      interestedEmployees.map(async (employee: any) => {
        // Calculate distance if venue and employee addresses are available
        let distance = null;
        if (job.venue && employee.profile) {
          const employeeAddress = await getEmployeeAddress(employee.profile.id, profile.org_id);
          if (employeeAddress && job.venue) {
            const venue = job.venue as any; // Cast to any to avoid TypeScript errors
            const venueAddress = `${venue.address}, ${venue.city}, ${venue.state} ${venue.zip}`;
            distance = await calculateDistance(employeeAddress, venueAddress);
          }
        }
        
        // Get last assignment date
        const lastAssignment = await getLastAssignmentDate(employee.user_id);
        
        return {
          ...employee,
          distance,
          last_assignment_date: lastAssignment
        } as InterestedEmployee;
      })
    );
    
    // Sort the employees based on the sort option
    const sortedEmployees = sortEmployees(processedEmployees, sortOption);
    
    return { 
      data: sortedEmployees,
      roleCapacity: Array.from(roleCapacity.entries()).map(([id, data]) => ({
        id,
        ...data
      }))
    };
  } catch (error) {
    console.error("Error getting interested employees:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Assign a job to an employee
 * @param jobId The ID of the job
 * @param employeeId The ID of the employee
 * @param jobRequiredRoleId The ID of the job required role
 * @returns Object with success status and message
 */
export async function assignJobToEmployee(
  jobId: string,
  employeeId: string,
  jobRequiredRoleId: string
) {
  const supabase = await createClient();
  
  // Check if user is logged in and is a manager
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You must be logged in" };
  }
  
  const hasAccess = await isManager();
  if (!hasAccess) {
    return { success: false, error: "Only managers can assign jobs" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { success: false, error: "You must be part of an organization" };
  }
  
  try {
    // Get the job to verify ownership and get time window
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        org_id,
        start_time,
        end_time,
        venue_id,
        venue:venue_id (
          id, name, address, city, state, zip
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job:", jobError);
      return { success: false, error: "Job not found" };
    }
    
    // Verify the job belongs to the user's organization
    if (job.org_id !== profile.org_id) {
      return { success: false, error: "You can only assign jobs in your organization" };
    }
    
    // Verify the job required role exists and belongs to this job
    const { data: jobRequiredRole, error: roleError } = await supabase
      .from('job_required_roles')
      .select('id, role_name, quantity_needed, job_id')
      .eq('id', jobRequiredRoleId)
      .eq('job_id', jobId)
      .single();
    
    if (roleError || !jobRequiredRole) {
      console.error("Error fetching job required role:", roleError);
      return { success: false, error: "Job required role not found" };
    }
    
    // Check assignment capacity for this role
    const { data: existingAssignments, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_required_role_id', jobRequiredRoleId);
    
    if (assignmentsError) {
      console.error("Error fetching existing assignments:", assignmentsError);
      return { success: false, error: "Failed to check assignment capacity" };
    }
    
    if (existingAssignments.length >= jobRequiredRole.quantity_needed) {
      return { success: false, error: `All positions for ${jobRequiredRole.role_name} are already filled` };
    }
    
    // Get employee's existing assignments to check for time conflicts
    const { data: employeeAssignments, error: employeeAssignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        id,
        job_id,
        jobs (
          id,
          start_time,
          end_time
        )
      `)
      .eq('user_id', employeeId);
    
    if (employeeAssignmentsError) {
      console.error("Error fetching employee assignments:", employeeAssignmentsError);
      return { success: false, error: "Failed to check for time conflicts" };
    }
    
    // Format assignments for time conflict check
    const formattedAssignments = employeeAssignments.map(assignment => {
      const jobData = assignment.jobs ? (Array.isArray(assignment.jobs) ? assignment.jobs[0] : assignment.jobs) : null;
      return {
        id: assignment.id,
        job_id: assignment.job_id,
        start_time: jobData?.start_time || '',
        end_time: jobData?.end_time || ''
      };
    });
    
    // Check for time conflicts - cast job to JobWithVenue to satisfy TypeScript
    if (hasTimeConflict({
      ...job,
      title: '', // Add required JobData properties
      description: '',
      status: 'available',
      travel_pay_offered: false
    }, formattedAssignments)) {
      return { success: false, error: "Employee has a time conflict with this job" };
    }
    
    // Insert assignment
    const { data: assignment, error: insertError } = await supabase
      .from('job_assignments')
      .insert([
        {
          job_id: jobId,
          user_id: employeeId,
          job_required_role_id: jobRequiredRoleId,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
          status: 'assigned'
        }
      ])
      .select()
      .single();
    
    if (insertError) {
      console.error("Error assigning job:", insertError);
      return { success: false, error: insertError.message };
    }
    
    // Update job status if all required roles are now filled
    await updateJobStatusIfAllRolesFilled(jobId);
    
    // Send notification to the employee about the job assignment
    try {
      // Get employee profile to get their name
      const { data: employeeProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', employeeId)
        .single();
      
      // Get more job details for the notification
      const { data: jobDetails } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();
      
      // Format job details for notification
      const jobTitle = jobDetails?.title || 'New job';
      const jobDate = new Date(job.start_time).toLocaleDateString();
      const jobTime = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Handle venue data - job.venue might be an array or an object depending on how it was fetched
      const venue = Array.isArray(job.venue) ? job.venue[0] : job.venue;
      const venueName = venue?.name || 'venue';
      
      // Create notification service
      const notificationService = createNotificationService(supabase);
      
      // Send notification to employee
      await notificationService.sendNotificationForEvent({
        eventType: 'job_assignment',
        userId: employeeId,
        title: 'New Job Assignment',
        body: `You have been assigned to ${jobTitle} at ${venueName} on ${jobDate} at ${jobTime}.`,
        metadata: {
          jobId,
          jobRequiredRoleId,
          assignedBy: user.id,
          assignedAt: new Date().toISOString(),
          venueName: venue?.name,
          venueAddress: venue ? `${venue.address}, ${venue.city}, ${venue.state} ${venue.zip}` : null,
          jobStartTime: job.start_time,
          jobEndTime: job.end_time
        }
      });
    } catch (notificationError) {
      // Log notification error but don't fail the assignment
      console.error("Error sending job assignment notification:", notificationError);
    }
    
    revalidatePath(`/dashboard/manager/jobs/${jobId}`);
    return { success: true, message: "Job assigned successfully" };
  } catch (error) {
    console.error("Error assigning job:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}