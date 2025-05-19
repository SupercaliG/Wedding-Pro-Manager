import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { getJobsByOrg, deleteJob } from "@/app/job-actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function JobManagementPage() {
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
  
  // Get jobs for the organization
  const { data: jobsData, error } = await getJobsByOrg();
  const jobs = jobsData || [];

  // Get venues for the organization (for filtering)
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('org_id', profile?.org_id || '');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Job Management</h1>
        <Link 
          href="/dashboard/manager/jobs/new" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Job
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-semibold mb-4 md:mb-0">All Jobs</h2>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search jobs..." 
                className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64"
              />
              <svg 
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select className="border border-gray-300 rounded-md px-4 py-2">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="available">Available</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
              Filter
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Venue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Travel Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{job.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {job.description?.substring(0, 50)}{job.description?.length > 50 ? '...' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{job.venue?.name || 'No venue'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(job.start_time).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                        {new Date(job.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.status === 'upcoming' 
                          ? 'bg-blue-100 text-blue-800' 
                          : job.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'completed'
                          ? 'bg-gray-100 text-gray-800'
                          : job.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.travel_pay_offered ? (
                        <div>
                          <span className="text-green-600 font-medium">${job.travel_pay_amount?.toFixed(2) || '0.00'}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Not offered</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/dashboard/manager/jobs/${job.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                        View
                      </Link>
                      <Link href={`/dashboard/manager/jobs/${job.id}/edit`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                        Edit
                      </Link>
                      <form action={deleteJob} className="inline">
                        <input type="hidden" name="jobId" value={job.id} />
                        <button type="submit" className="text-red-600 hover:text-red-900">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No jobs found. <Link href="/dashboard/manager/jobs/new" className="text-blue-600 hover:underline">Create your first job</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {jobs.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{jobs.length}</span> of <span className="font-medium">{jobs.length}</span> results
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-500">
                Previous
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-blue-600 text-white">
                1
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Job Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Jobs:</span>
              <span className="font-bold text-lg">{jobs.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Upcoming Jobs:</span>
              <span className="font-bold text-lg">{jobs.filter(job => job.status === 'upcoming').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Available Jobs:</span>
              <span className="font-bold text-lg">{jobs.filter(job => job.status === 'available').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Draft Jobs:</span>
              <span className="font-bold text-lg">{jobs.filter(job => job.status === 'draft').length}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/dashboard/manager/jobs/new" className="block text-blue-600 hover:underline">
              Create New Job
            </Link>
            <Link href="/dashboard/manager/venues" className="block text-blue-600 hover:underline">
              Manage Venues
            </Link>
            <Link href="/dashboard/manager" className="block text-blue-600 hover:underline">
              Return to Dashboard
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Upcoming Deadlines</h3>
          <div className="space-y-3">
            {jobs
              .filter(job => job.status === 'upcoming')
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .slice(0, 3)
              .map(job => (
                <div key={job.id} className="border-b border-gray-100 pb-2 last:border-0">
                  <p className="font-medium">{job.title}</p>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{job.venue?.name}</span>
                    <span>{new Date(job.start_time).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            }
            {jobs.filter(job => job.status === 'upcoming').length === 0 && (
              <p className="text-gray-600 italic">No upcoming jobs scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}