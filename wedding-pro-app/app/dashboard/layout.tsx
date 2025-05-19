import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isUserApproved, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { NotificationCenterWrapper } from "@/components/notifications/notification-center-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user is approved
  const isApproved = await isUserApproved();
  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center mb-4">Account Pending Approval</h1>
          <p className="text-gray-600 mb-4">
            Your account is currently pending approval by an administrator. 
            You'll receive an email once your account has been approved.
          </p>
          <div className="flex justify-center">
            <form action="/actions" method="post">
              <input type="hidden" name="action" value="signOut" />
              <button
                type="submit"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Get user profile to determine role
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === 'Admin';
  const isManager = profile?.role === 'Manager';

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-4">
        <div className="text-xl font-bold mb-8">Wedding Pro</div>
        <nav className="space-y-2">
          <Link href="/dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">
            Dashboard
          </Link>
          
          {/* Admin links */}
          {isAdmin && (
            <>
              <div className="pt-2 pb-1 text-xs uppercase text-gray-400 font-semibold">Admin</div>
              <Link href="/dashboard/users" className="block py-2 px-4 rounded hover:bg-gray-700">
                User Management
              </Link>
              <Link href="/dashboard/invite" className="block py-2 px-4 rounded hover:bg-gray-700">
                Invite Users
              </Link>
              <Link href="/dashboard/organization" className="block py-2 px-4 rounded hover:bg-gray-700">
                Organization Settings
              </Link>
              <Link href="/dashboard/admin/subscription" className="block py-2 px-4 rounded hover:bg-gray-700">
                Subscription
              </Link>
              <Link href="/dashboard/admin/audit-logs" className="block py-2 px-4 rounded hover:bg-gray-700">
                System Logs
              </Link>
              <Link href="/dashboard/admin/drop-requests" className="block py-2 px-4 rounded hover:bg-gray-700">
                Drop Requests
              </Link>
            </>
          )}
          
          {/* Manager links */}
          {isManager && (
            <>
              <div className="pt-2 pb-1 text-xs uppercase text-gray-400 font-semibold">Management</div>
              <Link href="/dashboard/users" className="block py-2 px-4 rounded hover:bg-gray-700">
                Team Members
              </Link>
              <Link href="/dashboard/invite" className="block py-2 px-4 rounded hover:bg-gray-700">
                Invite Employees
              </Link>
              <Link href="/dashboard/manager/jobs" className="block py-2 px-4 rounded hover:bg-gray-700">
                Job Management
              </Link>
              <Link href="/dashboard/manager/team" className="block py-2 px-4 rounded hover:bg-gray-700">
                Team Overview
              </Link>
              <Link href="/dashboard/manager/venues" className="block py-2 px-4 rounded hover:bg-gray-700">
                Venue Management
              </Link>
              <Link href="/dashboard/manager/drop-requests" className="block py-2 px-4 rounded hover:bg-gray-700">
                Drop Requests
              </Link>
            </>
          )}
          
          {/* Employee links */}
          {profile?.role === 'Employee' && (
            <>
              <div className="pt-2 pb-1 text-xs uppercase text-gray-400 font-semibold">My Work</div>
              <Link href="/dashboard/employee/schedule" className="block py-2 px-4 rounded hover:bg-gray-700">
                My Schedule
              </Link>
              <Link href="/dashboard/employee/available-jobs" className="block py-2 px-4 rounded hover:bg-gray-700">
                Available Jobs
              </Link>
              <Link href="/dashboard/employee/notifications" className="block py-2 px-4 rounded hover:bg-gray-700">
                Notifications
              </Link>
            </>
          )}
          
          {/* Common links */}
          <div className="pt-2 pb-1 text-xs uppercase text-gray-400 font-semibold">Account</div>
          <Link href="/dashboard/profile" className="block py-2 px-4 rounded hover:bg-gray-700">
            My Profile
          </Link>
          
          <div className="pt-4 mt-4 border-t border-gray-700">
            <form action="/app/actions" method="post">
              <input type="hidden" name="action" value="signOut" />
              <button
                type="submit"
                className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="flex-1">
        {/* Header with notification center */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Wedding Pro Dashboard</h1>
          <div className="flex items-center space-x-4">
            <NotificationCenterWrapper />
          </div>
        </div>
        
        {/* Page content */}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}