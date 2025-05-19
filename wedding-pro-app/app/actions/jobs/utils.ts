"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

/**
 * Job data type definition
 */
export type JobData = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  venue_id: string;
  status: 'available' | 'pending' | 'assigned' | 'completed' | 'cancelled';
  travel_pay_offered: boolean;
  travel_pay_amount: number | null;
  created_by_user_id: string;
  org_id: string;
  created_at: string;
  completed_at?: string | null;
  first_assigned_at?: string | null;
  time_to_fill_duration?: string | null;
  assignment_to_completion_duration?: string | null;
};

/**
 * Job with venue data type definition
 */
export type JobWithVenue = JobData & {
  venue: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
};

/**
 * Check if the current user has manager permissions
 */
export async function checkManagerPermission() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { authorized: false, error: "You must be logged in" };
  }
  
  // Get user profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { authorized: false, error: "Profile not found" };
  }
  
  // Check if user is a manager
  const isUserManager = await isManager();
  if (!isUserManager) {
    return { authorized: false, error: "You must be a manager to perform this action" };
  }
  
  return { authorized: true, user, profile };
}

/**
 * Verify that a job belongs to the user's organization
 */
export async function verifyJobOrganization(
  supabase: SupabaseClient<Database>,
  jobId: string,
  orgId: string
) {
  // Get job details
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    console.error("Error verifying job organization:", error);
    return { verified: false, error: "Job not found" };
  }
  
  // Check if job belongs to the user's organization
  if (job.org_id !== orgId) {
    return { verified: false, error: "You don't have access to this job" };
  }
  
  return { verified: true, job };
}

/**
 * Calculate travel pay for a job based on organization settings and venue location
 */
export async function calculateTravelPay(orgId: string, venueId: string): Promise<number | null> {
  const supabase = await createClient();
  
  try {
    // Get organization travel pay settings
    const { data: orgSettings, error: orgError } = await supabase
      .from('organization_settings')
      .select('travel_pay_rate_per_mile, travel_pay_min_distance')
      .eq('org_id', orgId)
      .single();
    
    if (orgError || !orgSettings) {
      console.error("Error fetching organization settings:", orgError);
      return null;
    }
    
    // Get organization address
    const { data: orgAddress, error: addressError } = await supabase
      .from('organizations')
      .select('address, city, state, zip')
      .eq('id', orgId)
      .single();
    
    if (addressError || !orgAddress) {
      console.error("Error fetching organization address:", addressError);
      return null;
    }
    
    // Get venue address
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('address, city, state, zip')
      .eq('id', venueId)
      .single();
    
    if (venueError || !venue) {
      console.error("Error fetching venue address:", venueError);
      return null;
    }
    
    // Format addresses
    const orgAddressStr = `${orgAddress.address}, ${orgAddress.city}, ${orgAddress.state} ${orgAddress.zip}`;
    const venueAddressStr = `${venue.address}, ${venue.city}, ${venue.state} ${venue.zip}`;
    
    // Calculate distance
    const distance = await calculateDistance(orgAddressStr, venueAddressStr);
    
    // If distance is less than minimum, no travel pay
    if (!distance || distance < (orgSettings.travel_pay_min_distance || 0)) {
      return 0;
    }
    
    // Calculate travel pay
    const travelPay = Math.round(distance * (orgSettings.travel_pay_rate_per_mile || 0) * 100) / 100;
    return travelPay;
  } catch (error) {
    console.error("Error calculating travel pay:", error);
    return null;
  }
}

/**
 * Get employee's address for distance calculations
 */
export async function getEmployeeAddress(employeeId: string, orgId: string): Promise<string | null> {
  const supabase = await createClient();
  
  try {
    // Try to get employee's address first
    const { data: employee, error: employeeError } = await supabase
      .from('user_profiles')
      .select('address, city, state, zip')
      .eq('id', employeeId)
      .single();
    
    // If employee has address, use it
    if (!employeeError && employee && employee.address && employee.city && employee.state && employee.zip) {
      return `${employee.address}, ${employee.city}, ${employee.state} ${employee.zip}`;
    }
    
    // Otherwise, fall back to organization address
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('address, city, state, zip')
      .eq('id', orgId)
      .single();
    
    if (orgError || !org || !org.address || !org.city || !org.state || !org.zip) {
      console.error("Error fetching organization address:", orgError);
      return null;
    }
    
    return `${org.address}, ${org.city}, ${org.state} ${org.zip}`;
  } catch (error) {
    console.error("Error getting employee address:", error);
    return null;
  }
}

/**
 * Calculate distance between two addresses using a mapping service
 */
export async function calculateDistance(origin: string, destination: string): Promise<number | null> {
  try {
    // In a real implementation, this would call a mapping API like Google Maps
    // For now, we'll return a mock distance
    // This is a placeholder for the actual implementation
    
    // Mock implementation - in production, replace with actual API call
    const mockDistances: Record<string, number> = {
      // Some predefined distances for testing
      "123 Main St, Anytown, CA 12345|456 Venue Rd, Venueville, CA 54321": 15.7,
      "789 Org Ave, Orgtown, NY 67890|321 Event Ln, Eventville, NY 98765": 8.3,
    };
    
    const key = `${origin}|${destination}`;
    const reverseKey = `${destination}|${origin}`;
    
    if (mockDistances[key]) {
      return mockDistances[key];
    } else if (mockDistances[reverseKey]) {
      return mockDistances[reverseKey];
    }
    
    // Generate a semi-random distance for testing
    // In production, this would be replaced with an actual API call
    const hash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };
    
    const distance = (hash(key) % 500) / 10; // 0-50 miles with one decimal place
    return distance;
  } catch (error) {
    console.error("Error calculating distance:", error);
    return null;
  }
}

/**
 * Parse distance range from string (e.g., "0-5", "10+", "<20")
 */
export function parseDistanceRange(distanceStr: string): { min: number | null; max: number | null } | null {
  try {
    if (distanceStr.includes('-')) {
      // Range format: "0-5"
      const [min, max] = distanceStr.split('-').map(Number);
      return { min, max };
    } else if (distanceStr.startsWith('<')) {
      // Less than format: "<20"
      const max = Number(distanceStr.substring(1));
      return { min: null, max };
    } else if (distanceStr.startsWith('>') || distanceStr.endsWith('+')) {
      // Greater than format: ">10" or "10+"
      const min = Number(distanceStr.replace(/[>+]/g, ''));
      return { min, max: null };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing distance range:", error);
    return null;
  }
}

/**
 * Check if a job has time conflict with existing assignments
 */
export async function hasTimeConflict(
  employeeId: string,
  startTime: string,
  endTime: string,
  excludeJobId?: string
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Build query to check for conflicts
    let query = supabase
      .from('job_assignments')
      .select(`
        id,
        job_id,
        jobs (
          id,
          start_time,
          end_time
        )
      `)
      .eq('employee_id', employeeId)
      .not('status', 'eq', 'declined');
    
    // Exclude specific job if provided
    if (excludeJobId) {
      query = query.not('job_id', 'eq', excludeJobId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error checking time conflicts:", error);
      return false; // Assume no conflict if there's an error
    }
    
    // Check for time conflicts
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    for (const assignment of data) {
      const job = assignment.jobs;
      if (!job) continue;
      
      // Handle the case where jobs might be an array or a single object
      const jobData = Array.isArray(job) ? job[0] : job;
      if (!jobData) continue;
      
      const jobStartDate = new Date(jobData.start_time);
      const jobEndDate = new Date(jobData.end_time);
      
      // Check if there's an overlap
      if (
        (startDate >= jobStartDate && startDate < jobEndDate) || // Start time is during another job
        (endDate > jobStartDate && endDate <= jobEndDate) || // End time is during another job
        (startDate <= jobStartDate && endDate >= jobEndDate) // Job is completely contained within the time range
      ) {
        return true; // Conflict found
      }
    }
    
    return false; // No conflicts
  } catch (error) {
    console.error("Error checking time conflicts:", error);
    return false; // Assume no conflict if there's an error
  }
}