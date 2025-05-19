"use server";

import { createClient } from "@/utils/supabase/server";
import { createNotificationService } from "@/utils/notifications/notification-service";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Send notification to managers about a new drop request
 */
export async function sendDropRequestCreatedNotification(
  supabase: SupabaseClient,
  dropRequestId: string,
  jobAssignmentId: string,
  userId: string
) {
  try {
    // First get the job ID from the job assignment
    const { data: jobAssignment } = await supabase
      .from('job_assignments')
      .select('job_id, job_required_role_id')
      .eq('id', jobAssignmentId)
      .single();
    
    if (!jobAssignment) {
      console.error("Job assignment not found for notification");
      return { success: false };
    }
    
    // Get job details
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, start_time, org_id')
      .eq('id', jobAssignment.job_id)
      .single();
    
    if (!job) {
      console.error("Job not found for notification");
      return { success: false };
    }
    
    // Get role details
    const { data: role } = await supabase
      .from('job_required_roles')
      .select('role_name')
      .eq('id', jobAssignment.job_required_role_id)
      .single();
    
    // Get employee name
    const { data: employeeProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    
    // Get managers for this organization
    const { data: managers } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', job.org_id)
      .eq('role', 'manager');
    
    if (!managers || managers.length === 0) {
      console.error("No managers found for notification");
      return { success: false };
    }
    
    const notificationService = createNotificationService(supabase);
    
    // Format job details
    const jobTitle = job.title || 'Untitled Job';
    const jobDate = job.start_time ? new Date(job.start_time).toLocaleDateString() : 'unknown date';
    const roleName = role?.role_name || 'staff';
    const employeeName = employeeProfile?.full_name || 'An employee';
    
    // Send notification to each manager
    for (const manager of managers) {
      await notificationService.sendNotificationForEvent({
        eventType: 'drop_request_created',
        userId: manager.id,
        title: 'New Drop Request',
        body: `${employeeName} has requested to drop their ${roleName} assignment for ${jobTitle} on ${jobDate}.`,
        metadata: {
          dropRequestId,
          jobAssignmentId,
          employeeId: userId,
          employeeName: employeeProfile?.full_name,
          jobId: job.id,
          jobTitle: job.title,
          jobDate: job.start_time,
          roleName: role?.role_name
        }
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error sending drop request notification:", error);
    return { success: false };
  }
}

/**
 * Send notification to employee about their drop request being approved
 */
export async function sendDropRequestApprovedNotification(
  supabase: SupabaseClient,
  dropRequestId: string,
  userId: string,
  jobId: string,
  jobTitle: string,
  startTime: string
) {
  try {
    const notificationService = createNotificationService(supabase);
    
    // Format job details
    const formattedJobTitle = jobTitle || 'Untitled Job';
    const jobDate = startTime ? new Date(startTime).toLocaleDateString() : 'unknown date';
    
    await notificationService.sendNotificationForEvent({
      eventType: 'drop_request_approved',
      userId,
      title: 'Drop Request Approved',
      body: `Your request to drop the assignment for ${formattedJobTitle} on ${jobDate} has been approved.`,
      metadata: {
        dropRequestId,
        jobId,
        jobTitle: formattedJobTitle,
        jobDate: startTime
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error sending drop request approved notification:", error);
    return { success: false };
  }
}

/**
 * Send notification to employee about their drop request being rejected
 */
export async function sendDropRequestRejectedNotification(
  supabase: SupabaseClient,
  dropRequestId: string,
  userId: string,
  jobId: string,
  jobTitle: string,
  startTime: string,
  rejectionReason: string
) {
  try {
    const notificationService = createNotificationService(supabase);
    
    // Format job details
    const formattedJobTitle = jobTitle || 'Untitled Job';
    const jobDate = startTime ? new Date(startTime).toLocaleDateString() : 'unknown date';
    
    await notificationService.sendNotificationForEvent({
      eventType: 'drop_request_rejected',
      userId,
      title: 'Drop Request Rejected',
      body: `Your request to drop the assignment for ${formattedJobTitle} on ${jobDate} has been rejected. Reason: ${rejectionReason || 'No reason provided'}`,
      metadata: {
        dropRequestId,
        jobId,
        jobTitle: formattedJobTitle,
        jobDate: startTime,
        rejectionReason
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error sending drop request rejected notification:", error);
    return { success: false };
  }
}

/**
 * Send notification to admins about a drop request being escalated
 */
export async function sendDropRequestEscalatedNotification(
  supabase: SupabaseClient,
  dropRequestId: string,
  jobId: string,
  jobTitle: string,
  startTime: string,
  employeeId: string,
  employeeName: string,
  escalationReason: string,
  orgId: string
) {
  try {
    // Get admins for this organization
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'Admin');
    
    if (!admins || admins.length === 0) {
      console.error("No admins found for notification");
      return { success: false };
    }
    
    const notificationService = createNotificationService(supabase);
    
    // Format job details
    const formattedJobTitle = jobTitle || 'Untitled Job';
    const jobDate = startTime ? new Date(startTime).toLocaleDateString() : 'unknown date';
    const formattedEmployeeName = employeeName || 'An employee';
    
    // Send notification to each admin
    for (const admin of admins) {
      await notificationService.sendNotificationForEvent({
        eventType: 'org_announcement', // Using org_announcement for escalated requests since there's no specific type
        userId: admin.id,
        title: 'Drop Request Escalated',
        body: `A drop request from ${formattedEmployeeName} for ${formattedJobTitle} on ${jobDate} has been escalated. Reason: ${escalationReason || 'No reason provided'}`,
        metadata: {
          dropRequestId,
          jobId,
          jobTitle: formattedJobTitle,
          jobDate: startTime,
          employeeId,
          employeeName: formattedEmployeeName,
          escalationReason,
          orgId
        }
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error sending drop request escalated notification:", error);
    return { success: false };
  }
}