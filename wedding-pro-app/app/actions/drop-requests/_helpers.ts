// Helper function to safely extract job_id from dropRequest.job_assignment
export function getJobIdFromDropRequestAssignment(jobAssignment: unknown): string | null {
  if (!jobAssignment) {
    return null;
  }
  // If jobAssignment is an array, take the first element, then get job_id
  if (Array.isArray(jobAssignment) && jobAssignment.length > 0) {
    return (jobAssignment[0] as { job_id?: string })?.job_id ?? null;
  }
  // If jobAssignment is an object, directly get job_id
  if (typeof jobAssignment === 'object' && !Array.isArray(jobAssignment)) {
    return (jobAssignment as { job_id?: string })?.job_id ?? null;
  }
  return null;
}