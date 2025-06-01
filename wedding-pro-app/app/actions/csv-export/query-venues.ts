import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdmin } from "@/utils/supabase/auth-helpers";
import type { CSVExportOptions } from "./index"; // Assuming CSVExportOptions will remain in index.ts
import { getDateRangeFilter, hasExportPermission } from "./utils";

/**
 * Query venues data based on export options
 */
export async function queryVenuesData(options: CSVExportOptions): Promise<any[]> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  
  if (!profile || !profile.org_id) {
    throw new Error("User profile or organization not found");
  }
  
  // Check if user has permission to export venues data
  const hasPermissionToExport = await hasExportPermission(profile, 'venues'); // Renamed for clarity
  if (!hasPermissionToExport) {
    throw new Error("You don't have permission to export venues data");
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
  
  if (selectedFields.includes('name')) selectString += ', name';
  if (selectedFields.includes('description')) selectString += ', description';
  if (selectedFields.includes('parking_tips')) selectString += ', parking_tips';
  if (selectedFields.includes('permit_info')) selectString += ', permit_info';
  if (selectedFields.includes('markdown_tips')) selectString += ', markdown_tips';
  if (selectedFields.includes('created_at')) selectString += ', created_at';
  if (selectedFields.includes('updated_at')) selectString += ', updated_at';
  
  // Add location relation if any location fields are selected
  const locationFields = [
    'address_line1', 'address_line2', 'city', 'state_province',
    'postal_code', 'country', 'latitude', 'longitude'
  ];
  
  if (locationFields.some(field => selectedFields.includes(field))) {
    let locationSelect = 'location:locations (id';
    if (selectedFields.includes('address_line1')) locationSelect += ', address_line1';
    if (selectedFields.includes('address_line2')) locationSelect += ', address_line2';
    if (selectedFields.includes('city')) locationSelect += ', city';
    if (selectedFields.includes('state_province')) locationSelect += ', state_province';
    if (selectedFields.includes('postal_code')) locationSelect += ', postal_code';
    if (selectedFields.includes('country')) locationSelect += ', country';
    if (selectedFields.includes('latitude')) locationSelect += ', latitude';
    if (selectedFields.includes('longitude')) locationSelect += ', longitude';
    locationSelect += ')';
    selectString += ', ' + locationSelect;
  }
  
  // Add tags if needed
  if (selectedFields.includes('tags')) {
    selectString += ', tags:venue_tags (tag:tag_id (id, name))';
  }
  
  // Add organization_id
  selectString += ', organization_id';
  
  // Build the query - RLS will automatically filter based on user role
  let query = supabase
    .from('venues')
    .select(selectString);
    
  // Apply organization filter for managers and employees
  // Admins can see all venues due to RLS policies
  if (!await isAdmin()) {
    query = query.eq('organization_id', profile.org_id);
  }
  
  // Apply date range filter if applicable
  const { from, to } = getDateRangeFilter(options.dateRange);
  if (from) {
    query = query.gte('created_at', from.toISOString());
  }
  
  // Execute the query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error querying venues data:", error);
    throw new Error("Failed to query venues data");
  }
  
  return data || [];
}