/**
 * Job data type definition
 */
export type JobData = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  venue_id: string;
  status: 'available' | 'pending' | 'assigned' | 'completed' | 'cancelled' | 'open' | 'upcoming' | 'draft';
  travel_pay_offered: boolean;
  travel_pay_amount: number | null;
  created_by_user_id: string;
  org_id: string;
  created_at: string;
  completed_at?: string | null;
  first_assigned_at?: string | null;
  time_to_fill_duration?: string | null; // Interval type from Postgres
  assignment_to_completion_duration?: string | null; // Interval type from Postgres
};

/**
 * Type for venue data often associated with a job
 */
export type VenueData = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

/**
 * Job with venue data type definition
 */
export type JobWithVenue = JobData & {
  venue: VenueData;
};

/**
 * Type for job_required_roles items
 */
export type JobRequiredRole = {
  id: string; // Or number, depending on your schema
  role_name: string;
};

/**
 * Extended job type for available jobs list, including distance and required roles
 */
export type AvailableJob = JobWithVenue & {
  distance?: number | null;
  job_required_roles?: JobRequiredRole[] | null;
  // Add any other specific fields that distinguish an "available job"
};

// You can add other job-related types here as needed, for example:
// export type JobAssignment = { ... };
// export type JobInterest = { ... };