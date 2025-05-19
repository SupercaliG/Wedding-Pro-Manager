import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdminOrManager } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { inviteManager, inviteEmployee } from "@/app/user-management-actions";

export default async function InviteUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is admin or manager
  const hasAccess = await isAdminOrManager();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get current user profile to determine role
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === 'Admin';

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Invite Users</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Manager Invitation Form (Admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Invite Manager</h2>
            <p className="text-gray-600 mb-4">
              Managers can invite employees and manage job assignments.
            </p>
            
            <form action={inviteManager} className="space-y-4">
              <div>
                <label htmlFor="manager-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="manager-email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="manager-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="manager-fullName"
                  name="fullName"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="manager-phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="manager-phoneNumber"
                  name="phoneNumber"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Employee Invitation Form (Admin and Manager) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Invite Employee</h2>
          <p className="text-gray-600 mb-4">
            Employees will need approval before they can access the system.
          </p>
          
          <form action={inviteEmployee} className="space-y-4">
            <div>
              <label htmlFor="employee-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="employee-email"
                name="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="employee-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="employee-fullName"
                name="fullName"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="employee-phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="employee-phoneNumber"
                name="phoneNumber"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoApprove"
                name="autoApprove"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoApprove" className="ml-2 block text-sm text-gray-700">
                Auto-approve this employee
              </label>
            </div>
            
            <div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}