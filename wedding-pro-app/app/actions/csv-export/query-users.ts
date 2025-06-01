import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdmin } from "@/utils/supabase/auth-helpers";
import type { CSVExportOptions } from "./index"; // Assuming CSVExportOptions will remain in index.ts
import { getDateRangeFilter } from "./utils";

/**
 * Query users data based on export options
 */
export async function queryUsersData(options: CSVExportOptions): Promise<any[]> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  
  if (!profile || !profile.org_id) {
    throw new Error("User profile or organization not found");
  }
  
  // Only admins can export users data - this is a sensitive data type
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    throw new Error("Only administrators can export user data");
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
  
  if (selectedFields.includes('full_name')) selectString += ', full_name';
  if (selectedFields.includes('phone_number')) selectString += ', phone_number';
  if (selectedFields.includes('role')) selectString += ', role';
  if (selectedFields.includes('approval_status')) selectString += ', approval_status';
  if (selectedFields.includes('created_at')) selectString += ', created_at';
  if (selectedFields.includes('updated_at')) selectString += ', updated_at';
  if (selectedFields.includes('address')) selectString += ', address, city, state, zip, country';
  if (selectedFields.includes('last_login')) selectString += ', last_login';
  
  // Add email from auth_users if needed
  if (selectedFields.includes('email')) {
    selectString += ', auth_users:id (email)';
  }
  
  // Add org_id
  selectString += ', org_id';
  
  // Build the query - RLS will automatically filter based on user role
  let query = supabase
    .from('profiles')
    .select(selectString);
    
  // Apply organization filter - admins should only see users in their organization
  query = query.eq('org_id', profile.org_id);
  
  // Apply date range filter if applicable
  const { from, to } = getDateRangeFilter(options.dateRange);
  if (from) {
    query = query.gte('created_at', from.toISOString());
  }
  
  // Execute the query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error querying users data:", error);
    throw new Error("Failed to query users data");
  }
  
  return data || [];
}