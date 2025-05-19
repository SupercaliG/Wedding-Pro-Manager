import { createClient } from "@/utils/supabase/server";
import { isAdmin, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { getDropRequestsForAdmin } from "@/app/drop-request-actions";
import AdminDropRequestsClient from "./drop-requests-client";

export default async function AdminDropRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is admin
  const hasAccess = await isAdmin();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get current user profile
  const profile = await getCurrentUserProfile();
  
  // Get escalated drop requests (priority for admins)
  const { data: escalatedRequests, error: escalatedError } = await getDropRequestsForAdmin(['escalated']);
  
  // Get pending drop requests
  const { data: pendingRequests, error: pendingError } = await getDropRequestsForAdmin(['pending']);
  
  // Get resolved drop requests (approved or rejected)
  const { data: resolvedRequests, error: resolvedError } = await getDropRequestsForAdmin(['approved', 'rejected']);
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Drop Requests</h1>
      
      <AdminDropRequestsClient 
        escalatedRequests={escalatedRequests || []} 
        pendingRequests={pendingRequests || []} 
        resolvedRequests={resolvedRequests || []} 
      />
    </div>
  );
}