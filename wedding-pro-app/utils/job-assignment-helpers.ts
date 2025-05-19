import { createClient } from "@/utils/supabase/server";
import { InterestedEmployee, SortOption } from "@/app/job-assignment-actions";

/**
 * Helper function to get employee's address or fall back to organization's address
 */
export async function getEmployeeAddress(employeeId: string, orgId: string): Promise<string | null> {
  const supabase = await createClient();
  
  // Try to get employee's address from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('address, city, state, zip')
    .eq('id', employeeId)
    .single();
  
  // If employee has address, use it
  if (!profileError && profile && profile.address && profile.city && profile.state && profile.zip) {
    return `${profile.address}, ${profile.city}, ${profile.state} ${profile.zip}`;
  }
  
  // Fall back to organization's address
  const { data: org, error: orgError } = await supabase
    .from('orgs')
    .select('address, city, state, zip')
    .eq('id', orgId)
    .single();
  
  if (orgError || !org || !org.address || !org.city || !org.state || !org.zip) {
    console.error("Error fetching organization address:", orgError);
    return null;
  }
  
  return `${org.address}, ${org.city}, ${org.state} ${org.zip}`;
}

/**
 * Helper function to calculate distance between two addresses using Google Maps API
 */
export async function calculateDistance(origin: string, destination: string): Promise<number | null> {
  try {
    // Call Google Maps Distance Matrix API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Check if we got a valid response
    if (data.status !== 'OK' || !data.rows[0]?.elements[0]?.distance) {
      console.error("Error from Google Maps API:", data);
      return null;
    }
    
    // Get distance in miles (API returns meters)
    const distanceInMeters = data.rows[0].elements[0].distance.value;
    const distanceInMiles = distanceInMeters / 1609.34; // Convert meters to miles
    
    // Round to 1 decimal place
    return Math.round(distanceInMiles * 10) / 10;
  } catch (error) {
    console.error("Error calculating distance:", error);
    return null;
  }
}

/**
 * Helper function to get the last assignment date for an employee
 */
export async function getLastAssignmentDate(employeeId: string): Promise<string | null> {
  const supabase = await createClient();
  
  // Get the most recent completed job assignment
  const { data, error } = await supabase
    .from('job_assignments')
    .select(`
      id,
      job_id,
      job:job_id (
        id,
        end_time,
        status
      )
    `)
    .eq('user_id', employeeId)
    .eq('job.status', 'completed')
    .order('job.end_time', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0 || !data[0].job) {
    return null;
  }
  
  return data[0].job.end_time;
}

/**
 * Helper function to sort employees based on sort option
 */
export function sortEmployees(employees: InterestedEmployee[], sortOption: SortOption): InterestedEmployee[] {
  return [...employees].sort((a, b) => {
    switch (sortOption) {
      case 'lastAssignmentDate_asc':
        // Sort by last assignment date (ascending - oldest first)
        // Employees with no assignments come first (treated as infinitely distant past)
        if (!a.last_assignment_date && !b.last_assignment_date) return 0;
        if (!a.last_assignment_date) return -1;
        if (!b.last_assignment_date) return 1;
        return new Date(a.last_assignment_date).getTime() - new Date(b.last_assignment_date).getTime();
        
      case 'lastAssignmentDate_desc':
        // Sort by last assignment date (descending - newest first)
        // Employees with no assignments come last
        if (!a.last_assignment_date && !b.last_assignment_date) return 0;
        if (!a.last_assignment_date) return 1;
        if (!b.last_assignment_date) return -1;
        return new Date(b.last_assignment_date).getTime() - new Date(a.last_assignment_date).getTime();
        
      case 'distance_asc':
        // Sort by distance (ascending - closest first)
        // Employees with no distance come last
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return (a.distance || 0) - (b.distance || 0);
        
      case 'distance_desc':
        // Sort by distance (descending - furthest first)
        // Employees with no distance come last
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return (b.distance || 0) - (a.distance || 0);
        
      case 'interestDate_asc':
        // Sort by interest date (ascending - oldest first)
        return new Date(a.expressed_at).getTime() - new Date(b.expressed_at).getTime();
        
      case 'interestDate_desc':
        // Sort by interest date (descending - newest first)
        return new Date(b.expressed_at).getTime() - new Date(a.expressed_at).getTime();
        
      default:
        // Default to sorting by interest date (ascending)
        return new Date(a.expressed_at).getTime() - new Date(b.expressed_at).getTime();
    }
  });
}

/**
 * Helper function to update job status if all required roles are filled
 */
export async function updateJobStatusIfAllRolesFilled(jobId: string): Promise<void> {
  const supabase = await createClient();
  
  // Get job required roles and their quantity needed
  const { data: jobRequiredRoles, error: rolesError } = await supabase
    .from('job_required_roles')
    .select('id, role_name, quantity_needed')
    .eq('job_id', jobId);
  
  if (rolesError || !jobRequiredRoles || jobRequiredRoles.length === 0) {
    console.error("Error fetching job required roles:", rolesError);
    return;
  }
  
  // Get current assignments for the job
  const { data: assignments, error: assignmentsError } = await supabase
    .from('job_assignments')
    .select('id, job_required_role_id')
    .eq('job_id', jobId);
  
  if (assignmentsError) {
    console.error("Error fetching job assignments:", assignmentsError);
    return;
  }
  
  // Check if all roles are filled
  let allRolesFilled = true;
  
  for (const role of jobRequiredRoles) {
    const assignedCount = assignments.filter(a => a.job_required_role_id === role.id).length;
    if (assignedCount < role.quantity_needed) {
      allRolesFilled = false;
      break;
    }
  }
  
  // Update job status if all roles are filled
  if (allRolesFilled) {
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ status: 'upcoming' })
      .eq('id', jobId)
      .eq('status', 'available'); // Only update if current status is 'available'
    
    if (updateError) {
      console.error("Error updating job status:", updateError);
    }
  }
}