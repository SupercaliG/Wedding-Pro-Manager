import type { UserProfile } from "@/utils/supabase/auth-helpers";
import { isAdmin, hasRole } from "@/utils/supabase/auth-helpers";
import type { CSVExportOptions } from "./index"; // Assuming CSVExportOptions will remain in index.ts or be moved to a types.ts

/**
 * Helper function to get date range filter
 * @param dateRange The date range option selected by the user
 * @returns An object with from and to dates for filtering
 */
export function getDateRangeFilter(dateRange: CSVExportOptions['dateRange']): { from: Date | null; to: Date } {
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
export async function hasExportPermission(profile: UserProfile | null, dataScope: CSVExportOptions['dataScope']): Promise<boolean> {
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