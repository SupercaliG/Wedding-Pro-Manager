import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isEmployee } from "@/utils/supabase/auth-helpers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function EmployeeDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is employee
  const hasAccess = await isEmployee();
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

  // Placeholder data for jobs (would come from a real jobs table in a full implementation)
  const placeholderJobs = [
    { id: 1, title: 'Wedding Photography', venue: 'Grand Plaza Hotel', date: '2025-06-15', status: 'upcoming' },
    { id: 2, title: 'Corporate Event', venue: 'Business Center', date: '2025-06-20', status: 'upcoming' },
    { id: 3, title: 'Birthday Party', venue: 'Sunset Restaurant', date: '2025-06-25', status: 'available' },
    { id: 4, title: 'Anniversary Shoot', venue: 'Botanical Gardens', date: '2025-07-05', status: 'available' },
  ];

  // Filter jobs based on status
  const upcomingJobs = placeholderJobs.filter(job => job.status === 'upcoming');
  const availableJobs = placeholderJobs.filter(job => job.status === 'available');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Dashboard</h1>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* My Schedule Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">My Upcoming Jobs</h3>
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
              <Link href="/dashboard/employee/schedule" className="text-blue-600 hover:underline text-sm font-medium">
                View full schedule →
              </Link>
            </div>
          </div>
          
          {/* Available Jobs Widget */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Available Jobs</h3>
            {availableJobs.length > 0 ? (
              <div className="space-y-3">
                {availableJobs.slice(0, 3).map(job => (
                  <div key={job.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <p className="font-medium">{job.title}</p>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{job.venue}</span>
                      <span>{new Date(job.date).toLocaleDateString()}</span>
                    </div>
                    <button className="mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                      Express Interest
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No jobs available at this time.</p>
            )}
            <div className="mt-4">
              <Link href="/dashboard/employee/available-jobs" className="text-blue-600 hover:underline text-sm font-medium">
                View all available jobs →
              </Link>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/profile" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium">Update Profile</span>
            </Link>
            
            <Link href="/dashboard/employee/available-jobs" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Find Jobs</span>
            </Link>
            
            <Link href="/dashboard/employee/notifications" 
              className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm font-medium">Notifications</span>
            </Link>
          </div>
        </div>
        
        {/* Notifications Widget (Placeholder) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Recent Notifications</h3>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <p className="text-gray-600 italic">
              This section would display recent notifications for the employee. This is a placeholder for the full implementation.
            </p>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/employee/notifications" className="text-blue-600 hover:underline text-sm font-medium">
              View all notifications →
            </Link>
          </div>
        </div>
        
        {/* Upcoming Schedule (Calendar View Placeholder) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">My Schedule</h3>
          <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
            <p className="text-gray-600 italic">
              This section would display a calendar view of your upcoming jobs. This is a placeholder for the full implementation.
            </p>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/employee/schedule" className="text-blue-600 hover:underline text-sm font-medium">
              View full calendar →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}