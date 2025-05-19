import { createClient } from "@/utils/supabase/server";
import { isManager } from "@/utils/supabase/auth-helpers";
import { getJobById, deleteJob, markJobAsComplete } from "@/app/job-actions";
import { formatInterval } from "@/utils/format-helpers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function JobDetailPage({ params }: { params: { jobId: string } }) {
  const jobId = params.jobId;
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
  
  // Get job details
  const { data: job, error } = await getJobById(jobId);
  
  if (error || !job) {
    redirect("/dashboard/manager/jobs");
  }
  
  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calculate job duration in hours
  const startTime = new Date(job.start_time);
  const endTime = new Date(job.end_time);
  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  const durationFormatted = durationHours.toFixed(1);

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/manager/jobs" 
          className="text-blue-600 hover:text-blue-800 mr-4"
        >
          &larr; Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold">{job.title}</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Job Details</h2>
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
              </div>
              <div className="flex space-x-2">
                <Link
                  href={`/dashboard/manager/jobs/${jobId}/edit`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Edit Job
                </Link>
                {/* Show Mark as Complete button for jobs with appropriate status */}
                {(job.status === 'available' || job.status === 'upcoming' || job.status === 'in_progress') && (
                  <form action={async () => {
                    'use server';
                    const result = await markJobAsComplete(jobId);
                    if (!result.success) {
                      console.error(result.error);
                    }
                  }}>
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Mark as Complete
                    </button>
                  </form>
                )}
                <form action={deleteJob}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Delete Job
                  </button>
                </form>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(job.start_time)}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Time</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatTime(job.start_time)} - {formatTime(job.end_time)} ({durationFormatted} hours)
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Venue</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {job.venue ? (
                      <div>
                        <div className="font-medium">{job.venue.name}</div>
                        <div>{job.venue.address}</div>
                        <div>{job.venue.city}, {job.venue.state} {job.venue.zip}</div>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No venue assigned</span>
                    )}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">Travel Pay</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {job.travel_pay_offered ? (
                      <div className="text-green-600 font-medium">
                        ${job.travel_pay_amount?.toFixed(2) || '0.00'}
                      </div>
                    ) : (
                      <span className="text-gray-500">Not offered</span>
                    )}
                  </dd>
                </div>
                
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                    {job.description || <span className="text-gray-500 italic">No description provided</span>}
                  </dd>
                </div>
                
                {/* Display analytics metrics if job is completed */}
                {job.status === 'completed' && (
                  <>
                    <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-200">
                      <dt className="text-sm font-medium text-gray-500">Completion Analytics</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="block text-xs text-gray-500">Completed At</span>
                            <span className="font-medium">
                              {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">First Assigned At</span>
                            <span className="font-medium">
                              {job.first_assigned_at ? new Date(job.first_assigned_at).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Time to Fill</span>
                            <span className="font-medium">
                              {formatInterval(job.time_to_fill_duration)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500">Assignment to Completion</span>
                            <span className="font-medium">
                              {formatInterval(job.assignment_to_completion_duration)}
                            </span>
                          </div>
                        </div>
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Assigned Employees</h2>
              <Link
                href={`/dashboard/manager/jobs/${jobId}/assign`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Manage Assignments
              </Link>
            </div>
            <div className="border-t border-gray-200 pt-4">
              {/* This will be populated with actual assignments in a future update */}
              <p className="text-gray-500">
                No employees assigned yet. Click "Manage Assignments" to assign employees to this job.
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Job Activity</h2>
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs">JD</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Job Created
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}