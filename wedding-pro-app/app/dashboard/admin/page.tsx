import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdmin } from "@/utils/supabase/auth-helpers";
import { getOrganizationUsers } from "@/app/user-management-actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FEATURES } from "@/utils/feature-flags";
import { CSVExport } from "@/components/admin/csv-export";

export default async function AdminDashboard() {
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
  
  // Get organization details
  let org = null;
  if (profile?.org_id) {
    const { data: orgData } = await supabase
      .from('orgs')
      .select('name')
      .eq('id', profile.org_id)
      .single();
    
    org = orgData;
  }
  
  // Get users data for Admin dashboard
  const { data: pendingUsersData } = await getOrganizationUsers('pending');
  const pendingUsers = pendingUsersData || [];
  
  const { data: allUsersData } = await getOrganizationUsers();
  const allUsers = allUsersData || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Summary Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">User Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Users:</span>
                <span className="font-bold text-lg">{allUsers.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending Approvals:</span>
                <span className="font-bold text-lg text-amber-600">{pendingUsers.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Managers:</span>
                <span className="font-bold text-lg">{allUsers.filter((u: any) => u.role === 'Manager').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Employees:</span>
                <span className="font-bold text-lg">{allUsers.filter((u: any) => u.role === 'Employee').length}</span>
              </div>
            </div>
            {pendingUsers.length > 0 && (
              <div className="mt-4">
                <Link href="/dashboard/users" className="text-blue-600 hover:underline text-sm font-medium">
                  Review pending approvals →
                </Link>
              </div>
            )}
          </div>
          
          {/* Quick Links Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard/invite" className="text-blue-600 hover:underline flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite New User
                </Link>
              </li>
              <li>
                <Link href="/dashboard/organization" className="text-blue-600 hover:underline flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Organization Settings
                </Link>
              </li>
              <li>
                <Link href="/dashboard/admin/subscription" className="text-blue-600 hover:underline flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Manage Subscription
                </Link>
              </li>
              <li>
                <Link href="/dashboard/admin/audit-logs" className="text-blue-600 hover:underline flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View System Logs
                </Link>
              </li>
              {/* HoneyBook Integration Link - conditionally rendered based on feature flag */}
              {FEATURES.SHOW_HONEYBOOK_INTEGRATION && (
                <li>
                  <Link href="/dashboard/organization#honeybook" className="text-blue-600 hover:underline flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Manage HoneyBook Integration
                  </Link>
                </li>
              )}
            </ul>
          </div>
          
          {/* Organization Announcements Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Organization Announcements</h3>
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
              <p className="text-gray-600 italic text-sm">
                This is a placeholder for organization-wide announcements. In a full implementation, 
                admins would be able to create and manage announcements here.
              </p>
            </div>
            <div className="mt-4">
              <button className="text-blue-600 hover:underline text-sm font-medium">
                Create Announcement (Coming Soon)
              </button>
            </div>
          </div>
        </div>
        
        {/* Recent Activity Section (Placeholder) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Recent System Activity</h3>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <p className="text-gray-600 italic">
              This section would display recent system activity logs. This is a placeholder for the full implementation.
            </p>
          </div>
        </div>
        
        {/* CSV Export Section */}
        <CSVExport />
      </div>
    </div>
  );
}