"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function approveDropRequest(requestId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('drop_requests')
      .update({
        status: 'approved',
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Drop request approved successfully", data };
  } catch (err) {
    console.error("Error approving drop request:", err);
    return { success: false, error: "Failed to approve drop request" };
  }
}

export async function rejectDropRequest(requestId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('drop_requests')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Drop request rejected successfully", data };
  } catch (err) {
    console.error("Error rejecting drop request:", err);
    return { success: false, error: "Failed to reject drop request" };
  }
}

import {
  checkCreateDropRequestPermission,
  checkEmployeeDropRequestsPermission,
  checkManagerDropRequestsPermission
} from "./drop-requests/utils";

/**
 * Create a new drop request for a job assignment.
 * @param {string} jobAssignmentId
 * @param {string} reason
 * @returns {Promise<{ success: boolean, error?: string, data?: any }>}
 */
export async function createDropRequest(jobAssignmentId: string, reason: string) {
  try {
    const { authorized, user, error: permError } = await checkCreateDropRequestPermission();
    if (!authorized || !user) {
      return { success: false, error: permError || "Not authorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("drop_requests")
      .insert([
        {
          job_assignment_id: jobAssignmentId,
          requested_by_user_id: user.id,
          reason,
          status: "pending"
        }
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Error creating drop request:", err);
    return { success: false, error: "Failed to create drop request" };
  }
}

/**
 * Get all drop requests for the current employee.
 * @returns {Promise<{ data: any[], error?: string }>}
 */
import { buildEmployeeDropRequestsQuery, buildManagerDropRequestsQuery, buildAdminDropRequestsQuery } from "@/lib/queries/dropRequests";

export async function getDropRequestsForEmployee() {
  try {
    const { authorized, user, error: permError } = await checkEmployeeDropRequestsPermission();
    if (!authorized || !user) {
      return { data: [], error: permError || "Not authorized" };
    }

    const supabase = await createClient();
    const { data, error } = await buildEmployeeDropRequestsQuery(supabase, user.id);

    return { data: data || [], error: error?.message };
  } catch (err) {
    console.error("Error fetching employee drop requests:", err);
    return { data: [], error: "Failed to fetch drop requests" };
  }
}

/**
 * Get drop requests for managers, filtered by status.
 * @param {string[]} statuses
 * @returns {Promise<{ data: any[], error?: string }>}
 */
export async function getDropRequestsForManager(statuses: string[]) {
  try {
    const { authorized, user, error: permError } = await checkManagerDropRequestsPermission();
    if (!authorized || !user) {
      return { data: [], error: permError || "Not authorized" };
    }

    const supabase = await createClient();
    const { data, error } = await buildManagerDropRequestsQuery(supabase, statuses);

    return { data: data || [], error: error?.message };
  } catch (err) {
    console.error("Error fetching manager drop requests:", err);
    return { data: [], error: "Failed to fetch drop requests" };
  }
}

/**
 * Get drop requests for admins, filtered by status.
 * @param {string[]} statuses
 * @returns {Promise<{ data: any[], error?: string }>}
 */
export async function getDropRequestsForAdmin(statuses: string[]) {
  try {
    const supabase = await createClient();
    const { data, error } = await buildAdminDropRequestsQuery(supabase, statuses);

    return { data: data || [], error: error?.message };
  } catch (err) {
    console.error("Error fetching admin drop requests:", err);
    return { data: [], error: "Failed to fetch drop requests" };
  }
}