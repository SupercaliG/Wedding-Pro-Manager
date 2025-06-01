"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import {
  getEmployeeAddress,
  calculateDistance,
} from "./utils";
import type { JobWithVenue, AvailableJob } from "./types";
import { parseDistanceRange } from "./client-utils";

/**
 * Get jobs by organization
 */
export async function getJobsByOrg(status?: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Build query
  let query = supabase
    .from('jobs')
    .select(`
      *,
      venue:venue_id (
        id, name, address, city, state, zip
      )
    `)
    .eq('org_id', profile.org_id);
  
  // Add status filter if provided
  if (status) {
    query = query.eq('status', status);
  }
  
  // Execute query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching jobs:", error);
    return { error: "Failed to fetch jobs" };
  }
  
  return { data: data as unknown as JobWithVenue[] };
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { error: "Profile not found" };
  }
  
  // Build query
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      title,
      description,
      start_time,
      end_time,
      venue_id,
      status,
      travel_pay_offered,
      travel_pay_amount,
      created_by_user_id,
      org_id,
      created_at,
      completed_at,
      first_assigned_at,
      time_to_fill_duration,
      assignment_to_completion_duration,
      venue:venue_id (
        id, name, address, city, state, zip
      )
    `)
    .eq('id', jobId)
    .single();
  
  if (error) {
    console.error("Error fetching job:", error);
    return { error: "Failed to fetch job" };
  }
  
  // Check if user has access to this job
  // Ensure data.org_id exists before comparison
  if (data && profile.role !== 'Admin' && data.org_id !== profile.org_id) {
    return { error: "You don't have access to this job" };
  }
  
  // Ensure data and data.venue exist and data.venue is an array before accessing data.venue[0]
  if (!data || !data.venue || !Array.isArray(data.venue) || data.venue.length === 0) {
    console.error("Error fetching job: Venue data is missing or not in expected format.", data);
    return { error: "Failed to fetch job venue details" };
  }
  
  return { data: { ...data, venue: data.venue[0] } as JobWithVenue };
}

/**
 * Get available jobs for an employee with filtering options
 */
export async function getAvailableJobsForEmployee(
  filters?: {
    role?: string;
    distance?: string;
    status?: string;
  }
) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get org_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Build query
  let query = supabase
    .from('jobs')
    .select(`
      *,
      venue:venue_id (
        id, name, address, city, state, zip
      ),
      job_required_roles (
        id, role_name
      )
    `)
    .eq('org_id', profile.org_id)
    .in('status', ['available', 'pending', 'open']) // Ensure these are valid statuses
    .order('start_time', { ascending: true });
  
  // Apply role filter if provided
  if (filters?.role) {
    // This type of join filter might need to be done differently if job_required_roles is a separate table
    // For now, assuming it works as intended or might need adjustment based on actual schema
    query = query.filter('job_required_roles.role_name', 'eq', filters.role);
  }
  
  // Apply status filter if provided
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  // Execute query
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching available jobs:", error);
    return { error: "Failed to fetch available jobs" };
  }
  
  // If distance filter is provided, we need to filter the results after fetching
  // because we need to calculate the distance for each job
  let filteredData = data;
  if (filters?.distance && data) {
    // Get the employee's address or organization's address
    const employeeAddress = await getEmployeeAddress(profile.id, profile.org_id);
    if (!employeeAddress) {
      return { error: "Failed to get address for distance calculation" };
    }
    
    // Calculate distance for each job and filter based on the distance range
    const distanceRange = parseDistanceRange(filters.distance);
    if (distanceRange) {
      const jobsWithDistance = await Promise.all(
        data.map(async (job) => {
          const venue = job.venue;
          if (!venue || typeof venue !== 'object' || Array.isArray(venue)) { // Ensure venue is a single object
             // console.warn("Job has missing or invalid venue data for distance calculation:", job.id);
             return { ...job, distance: null };
          }
          
          const venueAddress = `${venue.address}, ${venue.city}, ${venue.state} ${venue.zip}`;
          const distance = await calculateDistance(employeeAddress, venueAddress);
          
          return { ...job, distance };
        })
      );
      
      filteredData = jobsWithDistance.filter(job => {
        if (job.distance === null) return true; // Or false, depending on desired behavior for jobs with no distance
        
        const { min, max } = distanceRange;
        if (min !== null && job.distance < min) return false;
        if (max !== null && job.distance > max) return false;
        
        return true;
      });
    }
  }
  
  // Consider returning type AvailableJob[] if that's the intended structure
  return { data: filteredData as AvailableJob[] };
}

/**
 * Get employee's current and future job assignments
 */
export async function getEmployeeAssignments(employeeId?: string) {
  const supabase = await createClient();
  
  // Get current user if employeeId is not provided
  let userIdToQuery = employeeId;
  if (!userIdToQuery) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: "You must be logged in" };
    }
    userIdToQuery = user.id;
  }
  
  // Get current date
  const now = new Date();
  const isoDate = now.toISOString();
  
  // Get assignments
  const { data, error } = await supabase
    .from('job_assignments')
    .select(`
      id,
      job_id,
      employee_id,
      status,
      jobs (
        id,
        title,
        start_time,
        end_time,
        venue_id,
        venue:venue_id (
          id, name, address, city, state, zip
        )
      )
    `)
    .eq('employee_id', userIdToQuery)
    .gte('jobs.start_time', isoDate) // Ensure 'jobs.start_time' is the correct path
    .order('jobs.start_time', { referencedTable: 'jobs', ascending: true }); // Specify referencedTable for order
  
  if (error) {
    console.error("Error fetching employee assignments:", error);
    return { error: "Failed to fetch employee assignments" };
  }
  
  return { data };
}