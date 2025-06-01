import { createClient } from "@/utils/supabase/server";
import { isAdmin, isAdminOrManager, getCurrentUserProfile, hasRole, UserProfile } from "@/utils/supabase/auth-helpers";
import { JobWithVenue } from "@/app/actions/jobs/types";
import { VenueWithLocation } from "@/app/venue-actions";
import { convertToCSV, hasExportPermission } from "./utils"; // Removed getDateRangeFilter as it's used by query functions
import { queryJobsData } from "./query-jobs";
import { queryUsersData } from "./query-users";
import { queryVenuesData } from "./query-venues";


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