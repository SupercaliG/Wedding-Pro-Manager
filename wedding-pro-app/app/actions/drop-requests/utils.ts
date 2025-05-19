"use server";

import { createClient } from "@/utils/supabase/server";
import { isAdmin, isManager, isEmployee, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks if the current user is authorized to create a drop request
 */
export async function checkCreateDropRequestPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authorized: false, user: null, error: "You must be logged in to create a drop request" };
  }
  
  // Verify the user is an employee
  const hasAccess = await isEmployee();
  if (!hasAccess) {
    return { authorized: false, user, error: "Only employees can create drop requests" };
  }
  
  return { authorized: true, user, error: null };
}

/**
 * Checks if the current user is authorized to view employee drop requests
 */
export async function checkEmployeeDropRequestsPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authorized: false, user: null, error: "You must be logged in to view drop requests" };
  }
  
  // Verify the user is an employee
  const hasAccess = await isEmployee();
  if (!hasAccess) {
    return { authorized: false, user, error: "Only employees can view their drop requests" };
  }
  
  return { authorized: true, user, error: null };
}

/**
 * Checks if the current user is authorized to view manager drop requests
 */
export async function checkManagerDropRequestsPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authorized: false, user: null, error: "You must be logged in to view drop requests" };
  }
  
  // Verify the user is a manager
  const hasAccess = await isManager();
  if (!hasAccess) {
    return { authorized: false, user, error: "Only managers can view drop requests" };
  }
  
  // Get the manager's profile to get their org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { authorized: false, user, profile, error: "Manager profile or organization not found" };
  }
  
  return { authorized: true, user, profile, error: null };
}

/**
 * Checks if the current user is authorized to view admin drop requests
 */
export async function checkAdminDropRequestsPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authorized: false, user: null, error: "You must be logged in to view drop requests" };
  }
  
  // Verify the user is an admin
  const hasAccess = await isAdmin();
  if (!hasAccess) {
    return { authorized: false, user, error: "Only admins can view escalated drop requests" };
  }
  
  // Get the admin's profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { authorized: false, user, error: "Admin profile not found" };
  }
  
  return { authorized: true, user, profile, error: null };
}

/**
 * Checks if the current user is authorized to approve/reject drop requests
 */
export async function checkModifyDropRequestPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { authorized: false, user: null, error: "You must be logged in to modify a drop request" };
  }
  
  // Verify the user is a manager or admin
  const isUserManager = await isManager();
  const isUserAdmin = await isAdmin();
  
  if (!isUserManager && !isUserAdmin) {
    return { 
      authorized: false, 
      user, 
      isManager: isUserManager, 
      isAdmin: isUserAdmin, 
      error: "Only managers and admins can modify drop requests" 
    };
  }
  
  // Get the current user's profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { 
      authorized: false, 
      user, 
      isManager: isUserManager, 
      isAdmin: isUserAdmin, 
      error: "User profile not found" 
    };
  }
  
  return { 
    authorized: true, 
    user, 
    profile, 
    isManager: isUserManager, 
    isAdmin: isUserAdmin, 
    error: null 
  };
}

/**
 * Gets the base drop request query for employee view
 */
export function getEmployeeDropRequestsQuery(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from('drop_requests')
    .select(`
      id,
      job_assignment_id,
      reason,
      status,
      requested_at,
      resolved_at,
      resolved_by_user_id,
      job_assignment:job_assignments (
        id,
        job_id,
        job_required_role_id,
        job:jobs (
          id,
          title,
          description,
          start_time,
          end_time,
          status,
          venue_id,
          venue:venues (
            id, name, address, city, state, zip
          )
        ),
        job_required_role:job_required_roles (
          id, role_name
        )
      )
    `)
    .eq('user_id', userId)
    .order('requested_at', { ascending: false });
}

/**
 * Gets the base drop request query for manager view
 */
export function getManagerDropRequestsQuery(
  supabase: SupabaseClient,
  orgId: string,
  statusFilters: string[]
) {
  return supabase
    .from('drop_requests')
    .select(`
      id,
      job_assignment_id,
      user_id,
      reason,
      status,
      requested_at,
      resolved_at,
      resolved_by_user_id,
      employee:user_id (
        id,
        full_name,
        email
      ),
      job_assignment:job_assignments (
        id,
        job_id,
        job_required_role_id,
        job:jobs (
          id,
          title,
          org_id,
          start_time,
          end_time,
          venue_id,
          venue:venues (
            id, name, address, city, state, zip
          )
        ),
        job_required_role:job_required_roles (
          id, role_name
        )
      )
    `)
    .in('status', statusFilters)
    .eq('job_assignment.job.org_id', orgId)
    .order('requested_at', { ascending: false });
}

/**
 * Gets the base drop request query for admin view
 */
export function getAdminDropRequestsQuery(
  supabase: SupabaseClient,
  orgId: string | null,
  statusFilters: string[]
) {
  let query = supabase
    .from('drop_requests')
    .select(`
      id,
      job_assignment_id,
      user_id,
      reason,
      status,
      requested_at,
      resolved_at,
      resolved_by_user_id,
      employee:user_id (
        id,
        full_name,
        email
      ),
      job_assignment:job_assignments (
        id,
        job_id,
        job_required_role_id,
        job:jobs (
          id,
          title,
          org_id,
          start_time,
          end_time,
          venue_id,
          venue:venues (
            id, name, address, city, state, zip
          )
        ),
        job_required_role:job_required_roles (
          id, role_name
        )
      )
    `)
    .in('status', statusFilters)
    .order('requested_at', { ascending: false });
  
  // If not a super admin, filter by org_id
  if (orgId) {
    query = query.eq('job_assignment.job.org_id', orgId);
  }
  
  return query;
}

/**
 * Verifies that a job belongs to the user's organization
 */
export async function verifyJobOrganization(
  supabase: SupabaseClient,
  jobId: string,
  orgId: string | null
) {
  // If no org_id (super admin), skip this check
  if (!orgId) {
    return { verified: true };
  }
  
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, org_id')
    .eq('id', jobId)
    .single();
  
  if (jobError || !job) {
    return { verified: false, error: "Job not found" };
  }
  
  if (job.org_id !== orgId) {
    return { verified: false, error: "You can only approve drop requests for jobs in your organization" };
  }
  
  return { verified: true, job };
}