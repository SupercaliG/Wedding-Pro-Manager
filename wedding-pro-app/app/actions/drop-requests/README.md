# Drop Requests Module

This module handles all functionality related to drop requests in the Wedding Pro application. Drop requests are created when employees need to be removed from a job assignment.

## Structure

The module is organized into three main files:

1. **index.ts** - Contains the main action functions that can be called from the client
2. **utils.ts** - Contains utility functions for permission checking and query building
3. **notifications.ts** - Contains functions for sending notifications related to drop requests

## Main Functions

### For Employees

- `createDropRequest(jobAssignmentId, reason)` - Creates a new drop request
- `getDropRequestsForEmployee()` - Gets all drop requests for the current employee

### For Managers

- `getDropRequestsForManager(statusFilters)` - Gets drop requests for the manager's organization
- `approveDropRequest(dropRequestId)` - Approves a drop request
- `rejectDropRequest(dropRequestId, rejectionReason)` - Rejects a drop request
- `escalateDropRequest(dropRequestId, escalationReason)` - Escalates a drop request to admin

### For Admins

- `getDropRequestsForAdmin(statusFilters)` - Gets escalated drop requests for the admin to review

## Permissions

Each function includes appropriate permission checks to ensure that:

- Only employees can create drop requests for their own job assignments
- Only managers can view and modify drop requests for their organization
- Only admins can view and modify escalated drop requests

## Notifications

The module sends notifications for the following events:

- When a drop request is created (to managers)
- When a drop request is approved (to the employee)
- When a drop request is rejected (to the employee)
- When a drop request is escalated (to admins)

## Usage Example

```typescript
// Create a drop request
const { success, error } = await createDropRequest('job-assignment-id', 'Family emergency');

// Get drop requests for a manager
const { data, error } = await getDropRequestsForManager(['pending', 'escalated']);

// Approve a drop request
const { success, error } = await approveDropRequest('drop-request-id');
```

## Backward Compatibility

For backward compatibility, all functions are re-exported from the legacy location at `app/drop-request-actions.ts`. However, new code should import directly from this module:

```typescript
// Legacy import (deprecated)
import { createDropRequest } from '@/app/drop-request-actions';

// New import (preferred)
import { createDropRequest } from '@/app/actions/drop-requests';
```

## Database Schema

Drop requests are stored in the `drop_requests` table with the following structure:

- `id` - Unique identifier
- `job_assignment_id` - Reference to the job assignment
- `user_id` - The employee who created the request
- `reason` - The reason for the drop request
- `status` - Current status (pending, approved, rejected, escalated)
- `requested_at` - When the request was created
- `resolved_at` - When the request was resolved
- `resolved_by_user_id` - Who resolved the request
- `rejection_reason` - Reason for rejection (if applicable)
- `escalated_at` - When the request was escalated (if applicable)
- `escalated_by_user_id` - Who escalated the request (if applicable)
- `escalation_reason` - Reason for escalation (if applicable)