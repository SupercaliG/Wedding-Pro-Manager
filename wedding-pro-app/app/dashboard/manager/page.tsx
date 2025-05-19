import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { getOrganizationUsers } from "@/app/user-management-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ManagerDashboard() {
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
  
  // Get users data for Manager dashboard
  const { data: pendingUsersData } = await getOrganizationUsers('pending');
  const pendingUsers: any[] = pendingUsersData || [];
  
  const { data: allUsersData } = await getOrganizationUsers();
  const allUsers: any[] = allUsersData || [];

  // Placeholder data for jobs (would come from a real jobs table in a full implementation)
  const placeholderJobs = [
    { id: 1, title: 'Wedding Photography', venue: 'Grand Plaza Hotel', date: '2025-06-15', status: 'upcoming' },
    { id: 2, title: 'Corporate Event', venue: 'Business Center', date: '2025-06-20', status: 'upcoming' },
    { id: 3, title: 'Birthday Party', venue: 'Sunset Restaurant', date: '2025-06-25', status: 'available' },
    { id: 4, title: 'Anniversary Shoot', venue: 'Botanical Gardens', date: '2025-07-05', status: 'available' },
  ];

  // Filter jobs based on status
  const upcomingJobs = placeholderJobs.filter(job => job.status === 'upcoming');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Manager Dashboard</h1>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Overview Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Team Overview</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Team Members:</span>
                <span className="font-bold text-lg">{allUsers.filter(u => u.role === 'Employee').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending Approvals:</span>
                <span className="font-bold text-lg text-amber-600">
                  {pendingUsers.filter(u => u.role === 'Employee').length}
                </span>
              </div>
            </div>
            {pendingUsers.filter(u => u.role === 'Employee').length > 0 && (
              <div className="mt-4">
                <Link href="/dashboard/users" className="text-blue-600 hover:underline text-sm font-medium">
                  Review pending approvals →
                </Link>
              </div>
            )}
            <div className="mt-4">
              <Link href="/dashboard/manager/team" className="text-blue-600 hover:underline text-sm font-medium">
                View full team details →
              </Link>
            </div>
          </div>
          
          {/* Upcoming Jobs Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Upcoming Jobs</h3>
            {upcomingJobs.length > 0 ? (
              <div className="space-y-3">
                {upcomingJobs.slice(0, 3).map(job => (
                  <div key={job.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <p className="font-medium">{job.title}</p>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{job.venue}</span>
                      <span>{new Date(job.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No upcoming jobs scheduled.</p>
            )}
            <div className="mt-4">
              <Link href="/dashboard/manager/jobs" className="text-blue-600 hover:underline text-sm font-medium">
                View all jobs →
              </Link>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/invite" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="text-sm font-medium">Invite Employee</span>
            </Link>
            
            <Link href="/dashboard/manager/jobs/new" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm font-medium">Create New Job</span>
            </Link>
            
            <Link href="/dashboard/manager/venues" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-sm font-medium">Manage Venues</span>
            </Link>
          </div>
        </div>
        
        {/* Drop Requests Widget (Placeholder) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Pending Drop Requests</h3>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <p className="text-gray-600 italic">
              This section would display pending job drop requests from employees. This is a placeholder for the full implementation.
            </p>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/manager/requests" className="text-blue-600 hover:underline text-sm font-medium">
              View all requests →
            </Link>
          </div>
        </div>
        
        {/* Team Calendar (Placeholder) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Team Calendar</h3>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <p className="text-gray-600 italic">
              This section would display a calendar view of all team members' schedules. This is a placeholder for the full implementation.
            </p>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/manager/calendar" className="text-blue-600 hover:underline text-sm font-medium">
              View full calendar →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}