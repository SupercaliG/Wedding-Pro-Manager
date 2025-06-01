import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdmin } from "@/utils/supabase/auth-helpers";
import type { CSVExportOptions } from "./index"; // Assuming CSVExportOptions will remain in index.ts
import { getDateRangeFilter, hasExportPermission } from "./utils";

/**
 * Query jobs data based on export options
 */
export async function queryJobsData(options: CSVExportOptions): Promise<any[]> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  
  if (!profile || !profile.org_id) {
    throw new Error("User profile or organization not found");
  }
  
  // Check if user has permission to export jobs data
  const hasPermissionToExport = await hasExportPermission(profile, 'jobs'); // Renamed for clarity
  if (!hasPermissionToExport) {
    throw new Error("You don't have permission to export jobs data");
  }
  
  // Determine which fields to select based on selectedFields
  const selectedFields = Object.entries(options.selectedFields)
    .filter(([_, selected]) => selected)
    .map(([field]) => field);
  
  // Always include id field for reference
  if (!selectedFields.includes('id')) {
    selectedFields.push('id');
  }
  
  // Build the select string for the query
  let selectString = 'id';
  
  if (selectedFields.includes('title')) selectString += ', title';
  if (selectedFields.includes('description')) selectString += ', description';
  if (selectedFields.includes('start_time')) selectString += ', start_time';
  if (selectedFields.includes('end_time')) selectString += ', end_time';
  if (selectedFields.includes('status')) selectString += ', status';
  if (selectedFields.includes('travel_pay_offered')) selectString += ', travel_pay_offered';
  if (selectedFields.includes('travel_pay_amount')) selectString += ', travel_pay_amount';
  if (selectedFields.includes('created_at')) selectString += ', created_at';
  if (selectedFields.includes('completed_at')) selectString += ', completed_at';
  if (selectedFields.includes('first_assigned_at')) selectString += ', first_assigned_at';
  if (selectedFields.includes('time_to_fill_duration')) selectString += ', time_to_fill_duration';
  if (selectedFields.includes('assignment_to_completion_duration')) selectString += ', assignment_to_completion_duration';
  
  // Add venue relation if needed
  if (selectedFields.includes('venue_name') || selectedFields.includes('venue_address')) {
    let venueSelect = 'venue:venue_id (id';
    if (selectedFields.includes('venue_name')) venueSelect += ', name';
    if (selectedFields.includes('venue_address')) venueSelect += ', address, city, state, zip';
    venueSelect += ')';
    selectString += ', ' + venueSelect;
  }
  
  // Add job assignments if includeSubtasks is true
  if (options.includeSubtasks) {
    selectString += ', job_assignments (id, user_id, status, assigned_at, completed_at, profiles:user_id (full_name, email))';
  }
  
  // Add org_id
  selectString += ', org_id';
  
  // Build the query - RLS will automatically filter based on user role
  let query = supabase
    .from('jobs')
    .select(selectString);
    
  // Apply organization filter for managers and employees
  // Admins can see all jobs due to RLS policies
  if (!await isAdmin()) {
    query = query.eq('org_id', profile.org_id);
  }
  
  // Apply date range filter if applicable
  const { from, to } = getDateRangeFilter(options.dateRange);
  if (from) {
    query = query.gte('created_at', from.toISOString());
  }
  
  // Execute the query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error querying jobs data:", error);
    throw new Error("Failed to query jobs data");
  }
  
  return data || [];
}