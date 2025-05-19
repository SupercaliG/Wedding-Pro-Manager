import { createClient } from "@/utils/supabase/server";
import { isManager } from "@/utils/supabase/auth-helpers";
import { getJobById, updateJob } from "@/app/job-actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";

export default async function EditJobPage({ params }: { params: { jobId: string } }) {
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
  
  // Get user profile to get org_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  
  if (!profile || !profile.org_id) {
    redirect("/dashboard");
  }
  
  // Get job details
  const { data: job, error } = await getJobById(jobId);
  
  if (error || !job) {
    redirect("/dashboard/manager/jobs");
  }
  
  // Verify the job belongs to the user's organization
  if (job.org_id !== profile.org_id) {
    redirect("/dashboard/manager/jobs");
  }
  
  // Get venues for the organization
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('org_id', profile.org_id);

  // Format dates for the datetime-local input
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/manager/jobs" 
          className="text-blue-600 hover:text-blue-800 mr-4"
        >
          &larr; Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold">Edit Job</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <form action={(formData) => updateJob(jobId, formData)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Job Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                defaultValue={job.title}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Wedding Photography"
              />
            </div>
            
            {/* Venue */}
            <div>
              <label htmlFor="venue_id" className="block text-sm font-medium text-gray-700 mb-1">
                Venue *
              </label>
              <select
                id="venue_id"
                name="venue_id"
                required
                defaultValue={job.venue_id}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a venue</option>
                {venues && venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
              {(!venues || venues.length === 0) && (
                <p className="mt-1 text-sm text-red-600">
                  No venues available. <Link href="/dashboard/manager/venues/new" className="text-blue-600 hover:underline">Create a venue first</Link>.
                </p>
              )}
            </div>
            
            {/* Start Time */}
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                id="start_time"
                name="start_time"
                required
                defaultValue={formatDateForInput(job.start_time)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* End Time */}
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                id="end_time"
                name="end_time"
                required
                defaultValue={formatDateForInput(job.end_time)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={job.status}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="available">Available</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            {/* Travel Pay */}
            <div className="flex items-center">
              <div className="flex items-start mt-5">
                <div className="flex items-center h-5">
                  <input
                    id="travel_pay_offered"
                    name="travel_pay_offered"
                    type="checkbox"
                    defaultChecked={job.travel_pay_offered}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="travel_pay_offered" className="font-medium text-gray-700">
                    Offer Travel Pay
                  </label>
                  <p className="text-gray-500">
                    Travel pay will be calculated based on distance and your organization's rate.
                  </p>
                  {job.travel_pay_offered && job.travel_pay_amount && (
                    <p className="text-green-600 font-medium mt-1">
                      Current travel pay amount: ${job.travel_pay_amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Job Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={job.description || ''}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe the job details, requirements, etc."
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Link
              href="/dashboard/manager/jobs"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <SubmitButton>Update Job</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}