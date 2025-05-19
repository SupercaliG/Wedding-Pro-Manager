# HoneyBook Row-Level Security (RLS) Implementation

This document explains the Row-Level Security (RLS) implementation for HoneyBook-synced data in the Wedding Pro application.

## Overview

The HoneyBook integration syncs project data from HoneyBook into our application's `jobs` table, along with related data in the `venues` and `job_required_roles` tables. To ensure data security and proper isolation between organizations, we've implemented comprehensive RLS policies for these tables.

## Files

1. **`honeybook-rls-policies.sql`**: Contains the SQL statements to create and enforce RLS policies for:
   - `venues` table
   - `job_required_roles` table
   - Additional policies for HoneyBook-synced jobs in the `jobs` table

2. **`test-honeybook-rls.sql`**: Contains test scenarios to verify the RLS policies work correctly.

## RLS Policy Details

### Jobs Table

The existing RLS policies for the `jobs` table (in `jobs-rls-policies.sql`) already enforce proper data isolation based on `org_id`. We've added two additional policies specifically for HoneyBook-synced jobs:

1. **`prevent_delete_honeybook_jobs`**: Prevents Managers from deleting HoneyBook-synced jobs (those with a non-null `honeybook_project_id`). Only Admins can delete HoneyBook-synced jobs.

2. **`restrict_update_honeybook_jobs`**: Allows Managers to update HoneyBook-synced jobs, but with restrictions. This ensures that while Managers can make certain changes to HoneyBook jobs, they cannot modify critical fields that would break the sync.

### Venues Table

We've implemented a complete set of RLS policies for the `venues` table:

1. **`admin_all_venues`**: Admins have full access to all venues.
2. **`manager_read_venues`**: Managers can read venues in their organization.
3. **`manager_insert_venues`**: Managers can insert venues for their organization.
4. **`manager_update_venues`**: Managers can update venues in their organization.
5. **`manager_delete_venues`**: Managers can delete venues in their organization.
6. **`employee_read_venues`**: Employees can read venues in their organization.

### Job Required Roles Table

We've implemented a complete set of RLS policies for the `job_required_roles` table:

1. **`admin_all_job_roles`**: Admins have full access to all job roles.
2. **`manager_read_job_roles`**: Managers can read job roles for jobs in their organization.
3. **`manager_insert_job_roles`**: Managers can insert job roles for jobs in their organization.
4. **`manager_update_job_roles`**: Managers can update job roles for jobs in their organization.
5. **`manager_delete_job_roles`**: Managers can delete job roles for jobs in their organization.
6. **`employee_read_job_roles`**: Employees can read job roles for jobs in their organization.

## Key Security Considerations

1. **Organization Isolation**: All policies enforce strict isolation between organizations using the `org_id` field.

2. **Role-Based Access**: Different user roles (Admin, Manager, Employee) have different levels of access:
   - Admins have full access to all data across all organizations.
   - Managers have CRUD access to data within their organization, with restrictions on HoneyBook-synced jobs.
   - Employees have read-only access to data within their organization.

3. **HoneyBook Data Protection**: HoneyBook-synced jobs have additional protection to prevent accidental deletion by Managers, as these jobs should be managed through HoneyBook.

4. **Service Role Bypass**: The HoneyBook sync Edge Function runs with the service role, which bypasses RLS. This is necessary for the function to create and update jobs across organizations, but it means we must ensure the function correctly sets the `org_id` field to maintain data isolation.

## Testing Methodology

The `test-honeybook-rls.sql` script provides a comprehensive testing approach:

1. **Setup**: Creates test organizations, users, venues, jobs, and job roles.

2. **Test Scenarios**:
   - **Test 1**: Org A Manager accessing and modifying data
   - **Test 2**: Org A Employee accessing and attempting to modify data
   - **Test 3**: Org B Manager attempting to access Org A data
   - **Test 4**: Admin accessing and modifying data across organizations

3. **How to Run Tests**:
   - Connect to the Supabase database using `psql` or the Supabase dashboard SQL editor.
   - Run the `test-honeybook-rls.sql` script.
   - Review the results to ensure each test behaves as expected.
   - Use the cleanup section at the end to remove test data when needed.

## Verification Checklist

- [ ] Managers can only access jobs, venues, and job roles within their organization
- [ ] Employees can only read jobs, venues, and job roles within their organization
- [ ] Managers cannot delete HoneyBook-synced jobs
- [ ] Managers can update HoneyBook-synced jobs
- [ ] Admins have full access to all data, including HoneyBook-synced jobs
- [ ] Users from one organization cannot access data from another organization

## Implementation Notes

1. The RLS policies rely on the `profiles` table to determine user roles and organization membership.
2. All policies check for `approval_status = 'approved'` to ensure only approved users have access.
3. For the `job_required_roles` table, we join with the `jobs` table to enforce organization-based access.