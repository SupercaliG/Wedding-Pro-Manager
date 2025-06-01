"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { encodedRedirect } from "@/utils/utils";
import {
  calculateTravelPay,
  checkManagerPermission,
} from "./utils";
import type { JobData } from "./types";
import { sendJobCreatedNotifications } from "./notifications";

/**
 * Create a new job
 */
export async function createJob(formData: FormData) {
  const supabase = await createClient();
  
  // Check permissions
  const { authorized, user, profile, error: permError } = await checkManagerPermission(); // Renamed 'error' to 'permError' to avoid conflict
  if (!authorized) {
    return encodedRedirect("error", "/sign-in", permError || "Unauthorized");
  }
  
  // Extract form data
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString();
  const startTime = formData.get("start_time")?.toString();
  const endTime = formData.get("end_time")?.toString();
  const venueId = formData.get("venue_id")?.toString();
  const status = formData.get("status")?.toString() as JobData['status'];
  const travelPayOffered = formData.get("travel_pay_offered") === "on";
  
  // Validate required fields
  if (!title || !startTime || !endTime || !venueId || !status) {
    return encodedRedirect(
      "error",
      "/dashboard/manager/jobs/new",
      "Title, start time, end time, venue, and status are required"
    );
  }
  
  try {
    // Calculate travel pay if offered
    let travelPayAmount = null;
    if (travelPayOffered) {
      // Ensure profile and org_id are available
      if (!profile || !profile.org_id) {
        return encodedRedirect("error", "/dashboard/manager/jobs/new", "Organization ID not found for travel pay calculation.");
      }
      travelPayAmount = await calculateTravelPay(profile.org_id, venueId);
    }
    
    // Insert job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert([
        {
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          venue_id: venueId,
          status,
          travel_pay_offered: travelPayOffered,
          travel_pay_amount: travelPayAmount,
          created_by_user_id: user!.id, // user should be non-null if authorized
          org_id: profile!.org_id // profile should be non-null if authorized
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error("Error creating job:", error);
      return encodedRedirect("error", "/dashboard/manager/jobs/new", error.message);
    }
    
    // Send notifications for the new job
    await sendJobCreatedNotifications(supabase, job.id, user!.id); // user should be non-null if authorized
    
    revalidatePath('/dashboard/manager/jobs');
    return encodedRedirect("success", "/dashboard/manager/jobs", "Job created successfully");
  } catch (error) {
    console.error("Error creating job:", error);
    // Check if error is an instance of Error to access message property safely
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return encodedRedirect("error", "/dashboard/manager/jobs/new", errorMessage);
  }
}