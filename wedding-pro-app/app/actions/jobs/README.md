# Jobs Module

This module handles all functionality related to job management in the Wedding Pro application. Jobs represent events that need staffing and can be assigned to employees.

## Structure

The module is organized into three main files:

1. **index.ts** - Contains the main action functions that can be called from the client
2. **utils.ts** - Contains utility functions, type definitions, and permission checks
3. **notifications.ts** - Contains functions for sending notifications related to jobs

## Main Functions

### Job Management

- `createJob(formData)` - Creates a new job
- `updateJob(jobId, formData)` - Updates an existing job
- `deleteJob(formData)` - Deletes a job
- `markJobAsComplete(jobId)` - Marks a job as complete and calculates analytics metrics

### Job Retrieval

- `getJobsByOrg(status)` - Gets jobs for the current user's organization
- `getJobById(jobId)` - Gets detailed information about a specific job
- `getAvailableJobsForEmployee(filters)` - Gets jobs available for an employee with filtering options
- `getEmployeeAssignments(employeeId)` - Gets current and future job assignments for an employee

## Types

The module exports the following types:

- `JobData` - Represents the core job data structure
- `JobWithVenue` - Extends JobData with venue information

## Permissions

Each function includes appropriate permission checks to ensure that:

- Only managers can create, update, delete, and complete jobs
- Only users within the same organization can view jobs
- Jobs can only be modified by users in the same organization

## Notifications

The module sends notifications for the following events:

- When a job is created (to employees and managers)
- When a job is updated (to assigned employees and managers)
- When a job is completed (to assigned employees and admins)

## Usage Example

```typescript
// Create a new job
const result = await createJob(formData);

// Get jobs for the organization
const { data, error } = await getJobsByOrg('available');

// Mark a job as complete
const { success, message } = await markJobAsComplete('job-id');
```

## Backward Compatibility

For backward compatibility, all functions are re-exported from the legacy location at `app/job-actions.ts`. However, new code should import directly from this module:

```typescript
// Legacy import (deprecated)
import { createJob } from '@/app/job-actions';

// New import (preferred)
import { createJob } from '@/app/actions/jobs';
```

## Database Schema

Jobs are stored in the `jobs` table with the following structure:

- `id` - Unique identifier
- `title` - Job title
- `description` - Job description
- `start_time` - When the job starts
- `end_time` - When the job ends
- `venue_id` - Reference to the venue
- `status` - Current status (available, pending, assigned, completed, cancelled)
- `travel_pay_offered` - Whether travel pay is offered
- `travel_pay_amount` - Amount of travel pay if offered
- `created_by_user_id` - Who created the job
- `org_id` - Organization the job belongs to
- `created_at` - When the job was created
- `completed_at` - When the job was completed
- `first_assigned_at` - When the job was first assigned
- `time_to_fill_duration` - Time between creation and first assignment
- `assignment_to_completion_duration` - Time between first assignment and completion

## Related Modules

- **Job Assignments** - Handles assigning employees to jobs
- **Job Interests** - Handles employee interest in available jobs
- **Drop Requests** - Handles requests to drop job assignments