import { createClient } from "@/utils/supabase/server";
import { isManager } from "@/utils/supabase/auth-helpers";
import { getPendingAccountsViaEdgeFunction } from "@/app/user-management-actions";
import { redirect } from "next/navigation";
import { AccountApprovalsClient } from "../../admin/account-approvals/account-approvals-client";

// Server component for the manager account approvals page
export default async function ManagerAccountApprovalsPage() {
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
  
  // Get pending accounts
  const { data: pendingAccounts, error } = await getPendingAccountsViaEdgeFunction();
  
  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Account Approvals</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading pending accounts: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Account Approvals</h1>
      <p className="text-gray-600 mb-6">
        Review and manage pending account approval requests for your organization.
      </p>
      
      <AccountApprovalsClient pendingAccounts={pendingAccounts || []} />
    </div>
  );
}