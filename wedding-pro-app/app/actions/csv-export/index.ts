import { createClient } from "@/utils/supabase/server";
import { isAdmin, isAdminOrManager, getCurrentUserProfile, hasRole, UserProfile } from "@/utils/supabase/auth-helpers";
import { JobWithVenue } from "@/app/actions/jobs/utils";
import { VenueWithLocation } from "@/app/venue-actions";

/**
 * Type definition for CSV export options
 */
export type CSVExportOptions = {
  dataScope: 'jobs' | 'users' | 'venues';
  includeSubtasks?: boolean;
  dateRange: 'all' | 'month' | 'quarter' | 'year';
  selectedFields: Record<string, boolean>;
};

/**
 * Helper function to get date range filter
 * @param dateRange The date range option selected by the user
 * @returns An object with from and to dates for filtering
 */
function getDateRangeFilter(dateRange: CSVExportOptions['dateRange']): { from: Date | null; to: Date } {
  const to = new Date();
  let from: Date | null = null;
  
  switch (dateRange) {
    case 'month':
      from = new Date();
      from.setMonth(from.getMonth() - 1);
      break;
    case 'quarter':
      from = new Date();
      from.setMonth(from.getMonth() - 3);
      break;
    case 'year':
      from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      break;
    case 'all':
    default:
      from = null;
      break;
  }
  
  return { from, to };
}

/**
 * Check if user has permission to export data based on data scope
 * @param profile User profile
 * @param dataScope Type of data being exported
 * @returns Boolean indicating if user has permission
 */
async function hasExportPermission(profile: UserProfile | null, dataScope: CSVExportOptions['dataScope']): Promise<boolean> {
  if (!profile) return false;
  
  // Admins can export all data types
  const isUserAdmin = await isAdmin();
  if (isUserAdmin) return true;
  
  // Managers can only export jobs and venues data
  const isUserManager = await hasRole('Manager');
  if (isUserManager && (dataScope === 'jobs' || dataScope === 'venues')) return true;
  
  // Employees cannot export any data
  return false;
}

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
  const hasPermission = await hasExportPermission(profile, 'jobs');
  if (!hasPermission) {
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
  const hasPermission = await hasExportPermission(profile, 'venues');
  if (!hasPermission) {
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

/**
 * Helper function to convert data to CSV format
 * @param data Array of objects to convert to CSV
 * @param selectedFields Object with field names as keys and boolean values indicating if they should be included
 * @returns CSV formatted string
 */
export function convertToCSV(data: any[], selectedFields: Record<string, boolean>): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Get the fields that are selected
  const fields = Object.keys(selectedFields).filter(field => selectedFields[field]);
  
  // Helper function to escape CSV values
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains commas, quotes, or newlines, wrap it in quotes and escape any quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  };

  // Helper function to get nested property value
  const getNestedValue = (obj: any, path: string): any => {
    // Handle special cases for venue and location data
    if (path === 'venue_name' && obj.venue) {
      return obj.venue.name;
    }
    
    if (path === 'venue_address' && obj.venue) {
      const venue = obj.venue;
      return `${venue.address || ''}, ${venue.city || ''}, ${venue.state || ''} ${venue.zip || ''}`.trim();
    }
    
    // Handle email from auth_users
    if (path === 'email' && obj.auth_users) {
      return obj.auth_users.email;
    }
    
    // Handle location fields
    if (obj.location && ['address_line1', 'address_line2', 'city', 'state_province', 'postal_code', 'country', 'latitude', 'longitude'].includes(path)) {
      return obj.location[path];
    }
    
    // For regular fields, just return the value
    return obj[path];
  };

  // Create the header row
  const header = fields.map(field => escapeCSV(field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))).join(',');
  
  // Create the data rows
  const rows = data.map(item => {
    return fields.map(field => escapeCSV(getNestedValue(item, field))).join(',');
  });
  
  // Combine header and rows
  return [header, ...rows].join('\n');
}

/**
 * Generate CSV data for jobs
 */
export async function generateJobsCSV(options: CSVExportOptions): Promise<string> {
  // Query the data
  const jobsData = await queryJobsData(options);
  
  // Process job assignments if included
  let processedData = jobsData;
  
  // If includeSubtasks is true, we need to flatten the job assignments
  if (options.includeSubtasks && jobsData.length > 0 && jobsData[0].job_assignments) {
    processedData = [];
    
    // For each job, create a row for each assignment
    jobsData.forEach(job => {
      if (job.job_assignments && job.job_assignments.length > 0) {
        job.job_assignments.forEach((assignment: any) => {
          processedData.push({
            ...job,
            assignment_id: assignment.id,
            assignment_status: assignment.status,
            assignment_assigned_at: assignment.assigned_at,
            assignment_completed_at: assignment.completed_at,
            employee_name: assignment.profiles?.full_name || '',
            employee_email: assignment.profiles?.email || '',
          });
        });
      } else {
        // Include the job even if it has no assignments
        processedData.push(job);
      }
    });
    
    // Add assignment fields to selectedFields if they don't exist
    if (!options.selectedFields.assignment_id) {
      options.selectedFields.assignment_id = true;
    }
    if (!options.selectedFields.assignment_status) {
      options.selectedFields.assignment_status = true;
    }
    if (!options.selectedFields.assignment_assigned_at) {
      options.selectedFields.assignment_assigned_at = true;
    }
    if (!options.selectedFields.assignment_completed_at) {
      options.selectedFields.assignment_completed_at = true;
    }
    if (!options.selectedFields.employee_name) {
      options.selectedFields.employee_name = true;
    }
    if (!options.selectedFields.employee_email) {
      options.selectedFields.employee_email = true;
    }
  }
  
  // Convert to CSV
  return convertToCSV(processedData, options.selectedFields);
}

/**
 * Generate CSV data for users
 */
export async function generateUsersCSV(options: CSVExportOptions): Promise<string> {
  // Query the data
  const usersData = await queryUsersData(options);
  
  // Convert to CSV
  return convertToCSV(usersData, options.selectedFields);
}

/**
 * Generate CSV data for venues
 */
export async function generateVenuesCSV(options: CSVExportOptions): Promise<string> {
  // Query the data
  const venuesData = await queryVenuesData(options);
  
  // Process venue tags if included
  if (options.selectedFields.tags && venuesData.length > 0) {
    venuesData.forEach(venue => {
      if (venue.tags && Array.isArray(venue.tags)) {
        // Convert tags array to comma-separated string of tag names
        venue.tags = venue.tags
          .map((tagObj: any) => tagObj.tag?.name)
          .filter(Boolean)
          .join(', ');
      } else {
        venue.tags = '';
      }
    });
  }
  
  // Convert to CSV
  return convertToCSV(venuesData, options.selectedFields);
}

/**
 * Main export function that will be called from the UI
 */
export async function exportToCSV(options: CSVExportOptions): Promise<{ success: boolean; data?: string; error?: string; filename?: string }> {
  try {
    const profile = await getCurrentUserProfile();
    
    if (!profile) {
      return {
        success: false,
        error: "User profile not found"
      };
    }
    
    // Check if user has permission to export the requested data type
    const hasPermission = await hasExportPermission(profile, options.dataScope);
    if (!hasPermission) {
      return {
        success: false,
        error: `You don't have permission to export ${options.dataScope} data`
      };
    }

    // Generate CSV based on data scope
    let csvData: string;
    let filename: string;
    
    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      filename = `${options.dataScope}-export-${timestamp}.csv`;
      
      switch (options.dataScope) {
        case 'jobs':
          csvData = await generateJobsCSV(options);
          break;
        case 'users':
          csvData = await generateUsersCSV(options);
          break;
        case 'venues':
          csvData = await generateVenuesCSV(options);
          break;
        default:
          return {
            success: false,
            error: "Invalid data scope"
          };
      }
    } catch (queryError: any) {
      // Handle permission errors from the query functions
      return {
        success: false,
        error: queryError.message || "Failed to query data for export"
      };
    }

    return {
      success: true,
      data: csvData,
      filename
    };
  } catch (error: any) {
    console.error("Error exporting CSV:", error);
    return {
      success: false,
      error: error.message || "An error occurred while exporting data"
    };
  }
}