"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function switchActiveOrganization(newOrgId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Error fetching user or no user found:", userError);
    return { error: "User not authenticated." };
  }

  // Verify that the authenticated user is indeed a member of the newOrgId
  const { data: membership, error: membershipError } = await supabase
    .from("user_organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", newOrgId)
    .maybeSingle();

  if (membershipError) {
    console.error("Error verifying organization membership:", membershipError);
    return { error: "Failed to verify organization membership." };
  }

  if (!membership) {
    return { error: "User is not a member of the selected organization." };
  }

  // Call the SQL function to update the active_org_id in auth.users.raw_app_meta_data
  const { error: setActiveOrgError } = await supabase.rpc(
    "set_active_user_organization",
    {
      p_user_id: user.id,
      p_organization_id: newOrgId,
    }
  );

  if (setActiveOrgError) {
    console.error("Error setting active organization in DB:", setActiveOrgError);
    return { error: "Failed to switch active organization." };
  }

  // After successfully setting the new active organization,
  // we need to ensure the client gets a new JWT with the updated claims.
  // Revalidating paths that depend on user session or redirecting might trigger
  // Supabase middleware to refresh the token.
  // A more direct way might be needed if Supabase doesn't auto-refresh quickly.
  // For now, revalidate common paths and redirect to dashboard.
  // The client might need to be architected to listen for a custom event or
  // periodically check/refresh its token if immediate UI update is critical
  // without a full page reload.

  revalidatePath("/dashboard", "layout"); // Revalidate the dashboard and its layout
  revalidatePath("/protected", "layout"); // Revalidate other protected areas
  
  // Redirecting to the dashboard is a common pattern after such an action.
  // This will likely cause the Supabase client to fetch a new session/token.
  redirect("/dashboard");

  // Alternatively, instead of redirect, return a success message and let client handle refresh.
  // return { success: true, message: "Active organization switched successfully." };
}

export async function setActiveOrganizationAndRedirect(organizationId: string, redirectTo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("User not found for setting active organization.");
    return redirect("/sign-in?error=User not authenticated");
  }

  const { error: setActiveOrgError } = await supabase.rpc("set_active_user_organization", {
    p_user_id: user.id,
    p_organization_id: organizationId,
  });

  if (setActiveOrgError) {
    console.error("Error setting active organization from selection:", setActiveOrgError);
    return redirect(`/select-organization?error=${encodeURIComponent("Failed to set active organization.")}`);
  }
  
  const finalRedirectPath = redirectTo || "/protected";
  return redirect(finalRedirectPath);
}