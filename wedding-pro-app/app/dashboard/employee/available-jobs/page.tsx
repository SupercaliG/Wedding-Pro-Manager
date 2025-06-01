import { createClient } from "@/utils/supabase/server";
import { isEmployee, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import {
  getAvailableJobsForEmployee,
  getEmployeeAssignments,
} from "@/app/job-actions";
import type { JobWithVenue } from "app/actions/jobs/types";
import { JobListingClient } from "./components/job-listing-client";

export default async function AvailableJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  // TODO: Use resolvedSearchParams if/when filtering is implemented server-side

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
  if (!profile) {
    redirect("/dashboard");
  }

  // Get available jobs with no filters initially
  const { data: jobs, error: jobsError } = await getAvailableJobsForEmployee();
  
  // Get employee assignments for time conflict checking
  const { data: assignments, error: assignmentsError } = await getEmployeeAssignments();
  
  // Get organization details for address information
  const { data: org } = await supabase
    .from('orgs')
    .select('address, city, state, zip')
    .eq('id', profile.org_id)
    .single();
  
  // Get employee address details
  const { data: employeeProfile } = await supabase
    .from('profiles')
    .select('address, city, state, zip')
    .eq('id', profile.id)
    .single();
  
  // Format addresses for display and distance calculations
  let employeeAddress = null;
  if (employeeProfile?.address && employeeProfile?.city && employeeProfile?.state && employeeProfile?.zip) {
    employeeAddress = `${employeeProfile.address}, ${employeeProfile.city}, ${employeeProfile.state} ${employeeProfile.zip}`;
  }
  
  let orgAddress = null;
  if (org?.address && org?.city && org?.state && org?.zip) {
    orgAddress = `${org.address}, ${org.city}, ${org.state} ${org.zip}`;
  }
  
  // Extract all unique role names from jobs
  const allRoles = jobs ? Array.from(
    new Set(
      jobs.flatMap(job =>
        job.job_required_roles?.map((role: { role_name: string }) => role.role_name) || []
      )
    )
  ) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Available Jobs</h1>
      
      {/* Client-side job listing with filters */}
      {jobsError ? (
        <div className="bg-white rounded-lg shadow p-6 text-red-500">
          Error loading jobs: {jobsError}
        </div>
      ) : (
        <JobListingClient
          initialJobs={jobs as JobWithVenue[] || []}
          employeeAssignments={assignments ? assignments.map(assignment => ({
            id: assignment.id,
            job_id: assignment.job_id,
            start_time: assignment.jobs?.[0]?.start_time || '',
            end_time: assignment.jobs?.[0]?.end_time || ''
          })) : []}
          availableRoles={allRoles}
          employeeAddress={employeeAddress || undefined}
          orgAddress={orgAddress || undefined}
        />
      )}
    </div>
  );
}