import { createClient } from "@/utils/supabase/server";
import { isManager, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { getDropRequestsForManager } from "@/app/drop-request-actions";
import ManagerDropRequestsClient from "./drop-requests-client";

export default async function ManagerDropRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is manager
  const hasAccess = await isManager();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get current user profile
  const profile = await getCurrentUserProfile();
  
  // Get pending drop requests
  const { data: pendingRequests, error: pendingError } = await getDropRequestsForManager(['pending']);
  
  // Get resolved drop requests (approved or rejected)
  const { data: resolvedRequests, error: resolvedError } = await getDropRequestsForManager(['approved', 'rejected']);
  
  // Get escalated drop requests
  const { data: escalatedRequests, error: escalatedError } = await getDropRequestsForManager(['escalated']);
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Drop Requests</h1>
      
      <ManagerDropRequestsClient 
        pendingRequests={pendingRequests || []} 
        resolvedRequests={resolvedRequests || []} 
        escalatedRequests={escalatedRequests || []} 
      />
    </div>
  );
}