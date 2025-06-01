// Query utilities for drop requests
import { SupabaseClient } from "@supabase/supabase-js";

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