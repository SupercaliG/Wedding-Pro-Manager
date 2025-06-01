"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Import utility functions
import {
  checkCreateDropRequestPermission,
} from "./utils";

// Import notification functions
import {
  sendDropRequestCreatedNotification,
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