import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdminOrManager } from "@/utils/supabase/auth-helpers";
import { getOrganizationUsers } from "@/app/user-management-actions";
import { redirect } from "next/navigation";
import { updateUserApprovalStatus } from "@/app/user-management-actions";

export default async function UsersPage() {
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
  
  // Get all users in the organization
  const { data: allUsers, error } = await getOrganizationUsers();
  
  // Get pending users for approval
  const { data: pendingUsers } = await getOrganizationUsers('pending');
  
  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Users</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading users: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Users</h1>
      
      {/* Pending Approvals Section */}
      {pendingUsers && pendingUsers.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Pending Approvals</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingUsers.map((pendingUser: any) => {
                  // Skip if manager trying to approve non-employee
                  if (!isAdmin && pendingUser.role !== 'Employee') {
                    return null;
                  }
                  
                  return (
                    <tr key={pendingUser.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {pendingUser.full_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {pendingUser.auth_users?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {pendingUser.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <form action={updateUserApprovalStatus}>
                            <input type="hidden" name="userId" value={pendingUser.id} />
                            <input type="hidden" name="action" value="approve" />
                            <button
                              type="submit"
                              className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded text-sm"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={updateUserApprovalStatus}>
                            <input type="hidden" name="userId" value={pendingUser.id} />
                            <input type="hidden" name="action" value="reject" />
                            <button
                              type="submit"
                              className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* All Users Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">All Users</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allUsers && allUsers.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {user.auth_users?.email || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.approval_status === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : user.approval_status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}