"use server";

import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { createNotificationService } from "@/utils/notifications/notification-service";

/**
 * Send notifications when a job is created
 * 
 * @param supabase - Supabase client
 * @param jobId - ID of the created job
 * @param createdByUserId - ID of the user who created the job
 */
export async function sendJobCreatedNotifications(
  supabase: SupabaseClient<Database>,
  jobId: string,
  createdByUserId: string
) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        start_time,
        end_time,
        org_id,
        venue:venue_id (
          id,
          name
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job for notifications:", jobError);
      return;
    }
    
    // Format job date/time for notification
    const startDate = new Date(job.start_time);
    const endDate = new Date(job.end_time);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const formattedEndTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Get employees in the organization
    const { data: employees, error: employeesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', job.org_id)
      .eq('role', 'Employee');
    
    if (employeesError) {
      console.error("Error fetching employees for notifications:", employeesError);
      return;
    }
    
    // Get managers in the organization
    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', job.org_id)
      .in('role', ['Manager', 'Admin'])
      .neq('id', createdByUserId); // Don't notify the creator
    
    if (managersError) {
      console.error("Error fetching managers for notifications:", managersError);
      return;
    }
    
    // Create notification service
    const notificationService = createNotificationService(supabase);
    
    // Handle venue data which might be returned as an array from Supabase
    const venueData = Array.isArray(job.venue) ? job.venue[0] : job.venue;
    const venueName = venueData?.name || 'Unknown venue';
    
    // Prepare notification content
    const title = `New Job: ${job.title}`;
    const body = `A new job "${job.title}" has been created at ${venueName} on ${formattedDate} from ${formattedStartTime} to ${formattedEndTime}.`;
    
    // Send notifications to employees
    if (employees && employees.length > 0) {
      for (const employee of employees) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'job_assignment', // Using job_assignment for job creation
            userId: employee.id,
            title,
            body,
            metadata: {
              jobId: job.id,
              title: job.title,
              startTime: job.start_time,
              endTime: job.end_time,
              venueId: venueData?.id,
              venueName,
              createdBy: createdByUserId
            }
          });
        } catch (error) {
          console.error(`Error sending job created notification to employee ${employee.id}:`, error);
        }
      }
    }
    
    // Send notifications to managers
    if (managers && managers.length > 0) {
      for (const manager of managers) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'job_assignment', // Using job_assignment for job creation
            userId: manager.id,
            title,
            body,
            metadata: {
              jobId: job.id,
              title: job.title,
              startTime: job.start_time,
              endTime: job.end_time,
              venueId: venueData?.id,
              venueName,
              createdBy: createdByUserId,
              isManagerNotification: true
            }
          });
        } catch (error) {
          console.error(`Error sending job created notification to manager ${manager.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error sending job created notifications:", error);
  }
}

/**
 * Send notifications when a job is updated
 * 
 * @param supabase - Supabase client
 * @param jobId - ID of the updated job
 * @param updatedByUserId - ID of the user who updated the job
 */
export async function sendJobUpdatedNotifications(
  supabase: SupabaseClient<Database>,
  jobId: string,
  updatedByUserId: string
) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        start_time,
        end_time,
        org_id,
        venue:venue_id (
          id,
          name
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job for notifications:", jobError);
      return;
    }
    
    // Format job date/time for notification
    const startDate = new Date(job.start_time);
    const endDate = new Date(job.end_time);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedStartTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const formattedEndTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Get assigned employees for this job
    const { data: assignedEmployees, error: assignedError } = await supabase
      .from('job_assignments')
      .select('user_id')
      .eq('job_id', jobId)
      .neq('status', 'declined');
    
    if (assignedError) {
      console.error("Error fetching assigned employees for notifications:", assignedError);
      return;
    }
    
    // Get managers in the organization
    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', job.org_id)
      .in('role', ['Manager', 'Admin'])
      .neq('id', updatedByUserId); // Don't notify the updater
    
    if (managersError) {
      console.error("Error fetching managers for notifications:", managersError);
      return;
    }
    
    // Create notification service
    const notificationService = createNotificationService(supabase);
    
    // Handle venue data which might be returned as an array from Supabase
    const venueData = Array.isArray(job.venue) ? job.venue[0] : job.venue;
    const venueName = venueData?.name || 'Unknown venue';
    
    // Prepare notification content
    const title = `Job Updated: ${job.title}`;
    const body = `The job "${job.title}" at ${venueName} on ${formattedDate} from ${formattedStartTime} to ${formattedEndTime} has been updated.`;
    
    // Send notifications to assigned employees
    if (assignedEmployees && assignedEmployees.length > 0) {
      for (const assignment of assignedEmployees) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'job_assignment', // Using job_assignment for job updates
            userId: assignment.user_id,
            title,
            body,
            metadata: {
              jobId: job.id,
              title: job.title,
              startTime: job.start_time,
              endTime: job.end_time,
              venueId: venueData?.id,
              venueName,
              updatedBy: updatedByUserId,
              isUpdate: true
            }
          });
        } catch (error) {
          console.error(`Error sending job updated notification to employee ${assignment.user_id}:`, error);
        }
      }
    }
    
    // Send notifications to managers
    if (managers && managers.length > 0) {
      for (const manager of managers) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'job_assignment', // Using job_assignment for job updates
            userId: manager.id,
            title,
            body,
            metadata: {
              jobId: job.id,
              title: job.title,
              startTime: job.start_time,
              endTime: job.end_time,
              venueId: venueData?.id,
              venueName,
              updatedBy: updatedByUserId,
              isManagerNotification: true,
              isUpdate: true
            }
          });
        } catch (error) {
          console.error(`Error sending job updated notification to manager ${manager.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Error sending job updated notifications:", error);
  }
}

/**
 * Send notifications when a job is completed
 *
 * @param supabase - Supabase client
 * @param jobId - ID of the completed job
 * @param completedByUserId - ID of the user who marked the job as complete
 * @param completedAt - Timestamp when the job was marked as complete
 */
export async function sendJobCompletedNotifications(
  supabase: SupabaseClient<Database>,
  jobId: string,
  completedByUserId: string,
  completedAt: string
) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        start_time,
        end_time,
        org_id,
        venue:venue_id (
          id,
          name
        )
      `)
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      console.error("Error fetching job for notifications:", jobError);
      return;
    }
    
    // Format job date/time for notification
    const startDate = new Date(job.start_time);
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Get assigned employees for this job
    const { data: assignedEmployees, error: assignedError } = await supabase
      .from('job_assignments')
      .select(`
        user_id
      `)
      .eq('job_id', jobId);
    
    if (assignedError) {
      console.error("Error fetching assigned employees for notifications:", assignedError);
      return;
    }
    
    // Get admins and managers in the organization
    const { data: orgStaff, error: staffError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('org_id', job.org_id)
      .in('role', ['Admin', 'Manager'])
      .neq('id', completedByUserId); // Don't notify the completer
    
    if (staffError) {
      console.error("Error fetching org staff for notifications:", staffError);
      return;
    }
    
    // Create notification service
    const notificationService = createNotificationService(supabase);
    
    // Handle venue data which might be returned as an array from Supabase
    const venueData = Array.isArray(job.venue) ? job.venue[0] : job.venue;
    const venueName = venueData?.name || 'Unknown venue';
    
    // Prepare notification content
    const title = `Job Completed: ${job.title}`;
    const body = `The job "${job.title}" at ${venueName} on ${formattedDate} has been marked as complete.`;
    
    // Send notifications to assigned employees
    if (assignedEmployees && assignedEmployees.length > 0) {
      for (const assignment of assignedEmployees) {
        try {
          await notificationService.sendNotificationForEvent({
            eventType: 'job_completed',
            userId: assignment.user_id,
            title,
            body,
            metadata: {
              jobId: job.id,
              title: job.title,
              startTime: job.start_time,
              endTime: job.end_time,
              completedAt,
              venueId: venueData?.id,
              venueName,
              completedBy: completedByUserId
            }
          });
        } catch (error) {
          console.error(`Error sending job completed notification to employee ${assignment.user_id}:`, error);
        }
      }
    }
    
    // Send notifications to admins and managers
    if (orgStaff && orgStaff.length > 0) {
      for (const staff of orgStaff) {
        // Only send to admins for analytics purposes
        if (staff.role === 'Admin') {
          try {
            await notificationService.sendNotificationForEvent({
              eventType: 'job_completed',
              userId: staff.id,
              title,
              body,
              metadata: {
                jobId: job.id,
                title: job.title,
                startTime: job.start_time,
                endTime: job.end_time,
                completedAt,
                venueId: venueData?.id,
                venueName,
                completedBy: completedByUserId,
                isAdminNotification: true
              }
            });
          } catch (error) {
            console.error(`Error sending job completed notification to admin ${staff.id}:`, error);
          }
        }
      }
    }
      
  } catch (error) {
    console.error("Error sending job completed notifications:", error);
  }
}