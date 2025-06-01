import { createClient } from "@/utils/supabase/server";
import { isManager } from "@/utils/supabase/auth-helpers";
import { getJobById } from "@/app/job-actions";
import { getInterestedEmployeesForJob } from "@/app/job-assignment-actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import InterestedEmployeesList from "../components/interested-employees-list";
import JobRoleAssignment from "../components/job-role-assignment";

import type { SortOption } from "@/app/job-assignment-actions";

export default async function JobAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId } = await params;
  const sParams = searchParams ? await searchParams : undefined;
  // Validate sortOption to ensure it's a valid SortOption value
  const validSortOptions: SortOption[] = [
    'lastAssignmentDate_asc',
    'lastAssignmentDate_desc',
    'distance_asc',
    'distance_desc',
    'interestDate_asc',
    'interestDate_desc',
  ];
  const sortOptionRaw = sParams?.sort;
  const sortOption: SortOption =
    validSortOptions.includes(sortOptionRaw as SortOption)
      ? (sortOptionRaw as SortOption)
      : 'lastAssignmentDate_asc';
  
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
  const { data: job, error: jobError } = await getJobById(jobId);
  
  if (jobError || !job) {
    redirect("/dashboard/manager/jobs");
  }
  
  // Get interested employees with sorting
  const { data: interestedEmployees, roleCapacity, error: employeesError } =
    await getInterestedEmployeesForJob(jobId, sortOption);
  
  if (employeesError) {
    // Handle error but still render the page
    console.error("Error fetching interested employees:", employeesError);
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

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link 
          href={`/dashboard/manager/jobs/${jobId}`} 
          className="text-blue-600 hover:text-blue-800 mr-4"
        >
          &larr; Back to Job Details
        </Link>
        <h1 className="text-3xl font-bold">Assign Employees: {job.title}</h1>
      </div>
      
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Job Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Date & Time</p>
            <p className="text-sm text-gray-900">{formatDate(job.start_time)}</p>
            <p className="text-sm text-gray-900">
              {formatTime(job.start_time)} - {formatTime(job.end_time)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Venue</p>
            <p className="text-sm text-gray-900">{job.venue?.name || 'No venue'}</p>
            <p className="text-sm text-gray-900">
              {job.venue ? `${job.venue.city}, ${job.venue.state}` : ''}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Status</p>
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              job.status === 'available'
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
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InterestedEmployeesList 
            jobId={jobId} 
            interestedEmployees={interestedEmployees || []} 
            currentSort={sortOption}
          />
        </div>
        
        <div className="lg:col-span-1">
          <JobRoleAssignment 
            jobId={jobId} 
            roleCapacity={roleCapacity || []} 
            interestedEmployees={interestedEmployees || []}
          />
        </div>
      </div>
    </div>
  );
}