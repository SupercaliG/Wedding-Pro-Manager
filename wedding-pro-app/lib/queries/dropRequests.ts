// Query builders for drop requests (no server-only code here)
import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Employee drop requests query builder
export function buildEmployeeDropRequestsQuery(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  return supabase
    .from("drop_requests")
    .select(
      `
      *,
      job_assignment:job_assignment_id (
        id,
        job_id,
        job:job_id (
          id, title, start_time, end_time, venue_id,
          venue:venue_id (id, name, address, city, state, zip)
        )
      )
      `
    )
    .eq("requested_by_user_id", userId)
    .order("requested_at", { ascending: false });
}

// Manager drop requests query builder
export function buildManagerDropRequestsQuery(
  supabase: SupabaseClient<Database>,
  statuses: string[]
) {
  return supabase
    .from("drop_requests")
    .select(
      `
      *,
      job_assignment:job_assignment_id (
        id,
        job_id,
        job:job_id (
          id, title, start_time, end_time, venue_id,
          venue:venue_id (id, name, address, city, state, zip)
        )
      )
      `
    )
    .in("status", statuses)
    .order("requested_at", { ascending: false });
}

// Admin drop requests query builder
export function buildAdminDropRequestsQuery(
  supabase: SupabaseClient<Database>,
  statuses: string[]
) {
  return supabase
    .from("drop_requests")
    .select(
      `
      *,
      job_assignment:job_assignment_id (
        id,
        job_id,
        job:job_id (
          id, title, start_time, end_time, venue_id,
          venue:venue_id (id, name, address, city, state, zip)
        )
      )
      `
    )
    .in("status", statuses)
    .order("requested_at", { ascending: false });
}