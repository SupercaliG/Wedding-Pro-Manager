"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

// Import utility functions
import {
  checkEmployeeDropRequestsPermission,
  checkManagerDropRequestsPermission,
  checkAdminDropRequestsPermission,
} from "./utils";

/**
 * Fetches drop requests made by the current employee
 */
export async function getDropRequestsForEmployee() {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, user, error: permissionError } = await checkEmployeeDropRequestsPermission();
    if (!authorized) {
      if (!user) {
        redirect("/sign-in");
      }
      return { data: [], error: permissionError };
    }
    
    // Get the employee's drop requests with job details
    const { data, error } = await import("../../../lib/queries/dropRequestsUtils").then(mod =>
      mod.getEmployeeDropRequestsQuery(supabase, user!.id)
    );
    
    if (error) {
      console.error("Error fetching employee drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForEmployee:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}

/**
 * Fetches drop requests for a manager to review
 */
export async function getDropRequestsForManager(statusFilters: string[] = ['pending']) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, profile, error: permissionError } = await checkManagerDropRequestsPermission();
    if (!authorized) {
      return { data: [], error: permissionError };
    }
    
    // Get drop requests for jobs in the manager's organization
    const { data, error } = await import("../../../lib/queries/dropRequestsUtils").then(mod =>
      mod.getManagerDropRequestsQuery(supabase, profile!.org_id!, statusFilters)
    );
    
    if (error) {
      console.error("Error fetching manager drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForManager:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}

/**
 * Fetches drop requests for an admin to review
 */
export async function getDropRequestsForAdmin(statusFilters: string[] = ['escalated']) {
  try {
    const supabase = await createClient();
    
    // Check permissions
    const { authorized, profile, error: permissionError } = await checkAdminDropRequestsPermission();
    if (!authorized) {
      return { data: [], error: permissionError };
    }
    
    // Get drop requests based on admin's organization
    const { data, error } = await import("../../../lib/queries/dropRequestsUtils").then(mod =>
      mod.getAdminDropRequestsQuery(supabase, profile!.org_id, statusFilters)
    );
    
    if (error) {
      console.error("Error fetching admin drop requests:", error);
      return { data: [], error: "Failed to fetch drop requests" };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Error in getDropRequestsForAdmin:", error);
    return { data: [], error: "An unexpected error occurred" };
  }
}