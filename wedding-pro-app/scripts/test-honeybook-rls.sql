-- Test script for HoneyBook RLS policies
-- This script provides practical tests to verify RLS policies are working correctly
-- NOTE: This script only tests RLS policies and does not create test data
-- It assumes the following data already exists:
-- - Orgs with UUIDs
-- - Users with appropriate roles and organization assignments
-- - Jobs, venues, and job roles associated with orgs

-- IMPORTANT: Before running this script, replace the UUIDs below with actual UUIDs from your database
-- The script uses the following placeholder values:
-- Organization UUIDs:
--   Org A: '11111111-1111-1111-1111-111111111111'
--   Org B: '22222222-2222-2222-2222-222222222222'
-- User UUIDs:
--   Admin: '00000000-0000-0000-0000-000000000000'
--   Manager A: '11111111-0000-0000-0000-000000000000'
--   Employee A: '22222222-0000-0000-0000-000000000000'
--   Manager B: '33333333-0000-0000-0000-000000000000'
-- Job IDs:
--   Regular Job A: 'job_a1_id'
--   HoneyBook Job A: 'job_a2_id'
--   Regular Job B: 'job_b1_id'

-- ==========================================
-- TEST 1: Org A Manager accessing data
-- ==========================================

-- Set context to Manager from Org A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-0000-0000-0000-000000000000", "role": "authenticated"}';

-- Test 1.1: Manager from Org A should see jobs from Org A only
SELECT 'Test 1.1: Manager from Org A accessing jobs' as test_name;
SELECT id, title, org_id, honeybook_project_id FROM jobs WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Expected: Only jobs from Org A

-- Test 1.2: Manager from Org A should see venues from Org A only
SELECT 'Test 1.2: Manager from Org A accessing venues' as test_name;
SELECT id, name, org_id FROM venues WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Expected: Only venues from Org A

-- Test 1.3: Manager from Org A should see job roles for Org A jobs only
SELECT 'Test 1.3: Manager from Org A accessing job roles' as test_name;
SELECT jr.id, jr.role_name, j.org_id
FROM job_required_roles jr
JOIN jobs j ON jr.job_id = j.id
WHERE j.org_id = '11111111-1111-1111-1111-111111111111';
-- Expected: Only roles for Org A jobs

-- Test 1.4: Manager from Org A should be able to update regular jobs in Org A
SELECT 'Test 1.4: Manager from Org A updating regular job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- UPDATE jobs SET title = 'Updated Regular Job A1' WHERE id = 'job_a1_id' RETURNING id, title;
-- Expected: Update succeeds

-- Test 1.5: Manager from Org A should be able to update HoneyBook jobs in Org A
SELECT 'Test 1.5: Manager from Org A updating HoneyBook job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- UPDATE jobs SET title = 'Updated HoneyBook Job A2' WHERE id = 'job_a2_id' RETURNING id, title;
-- Expected: Update succeeds

-- Test 1.6: Manager from Org A should be able to delete regular jobs in Org A
SELECT 'Test 1.6: Manager from Org A deleting regular job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- DELETE FROM jobs WHERE id = 'job_a1_id' RETURNING id;
-- Expected: Delete succeeds

-- Test 1.7: Manager from Org A should NOT be able to delete HoneyBook jobs
SELECT 'Test 1.7: Manager from Org A deleting HoneyBook job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- DELETE FROM jobs WHERE id = 'job_a2_id' RETURNING id;
-- Expected: No rows returned (delete prevented by RLS)

-- ==========================================
-- TEST 2: Org A Employee accessing data
-- ==========================================

-- Set context to Employee from Org A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-0000-0000-0000-000000000000", "role": "authenticated"}';

-- Test 2.1: Employee from Org A should see jobs from Org A only
SELECT 'Test 2.1: Employee from Org A accessing jobs' as test_name;
SELECT id, title, org_id, honeybook_project_id FROM jobs WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Expected: Only jobs from Org A

-- Test 2.2: Employee from Org A should NOT be able to update jobs
SELECT 'Test 2.2: Employee from Org A updating job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- UPDATE jobs SET title = 'Employee Updated Job' WHERE id = 'job_a2_id' RETURNING id, title;
-- Expected: No rows returned (update prevented by RLS)

-- Test 2.3: Employee from Org A should NOT be able to delete jobs
SELECT 'Test 2.3: Employee from Org A deleting job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- DELETE FROM jobs WHERE id = 'job_a2_id' RETURNING id;
-- Expected: No rows returned (delete prevented by RLS)

-- ==========================================
-- TEST 3: Org B Manager accessing Org A data
-- ==========================================

-- Set context to Manager from Org B
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "33333333-0000-0000-0000-000000000000", "role": "authenticated"}';

-- Test 3.1: Manager from Org B should NOT see jobs from Org A
SELECT 'Test 3.1: Manager from Org B accessing Org A jobs' as test_name;
SELECT id, title, org_id FROM jobs WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Expected: No rows returned (prevented by RLS)

-- Test 3.2: Manager from Org B should NOT be able to update jobs from Org A
SELECT 'Test 3.2: Manager from Org B updating Org A job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- UPDATE jobs SET title = 'B Manager Updated Job' WHERE id = 'job_a2_id' RETURNING id, title;
-- Expected: No rows returned (update prevented by RLS)

-- ==========================================
-- TEST 4: Admin accessing all data
-- ==========================================

-- Set context to Admin user
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000000", "role": "authenticated"}';

-- Test 4.1: Admin should see jobs from all orgs
SELECT 'Test 4.1: Admin accessing all jobs' as test_name;
SELECT id, title, org_id FROM jobs WHERE org_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') ORDER BY org_id;
-- Expected: Jobs from both Org A and Org B

-- Test 4.2: Admin should be able to update any job, including HoneyBook jobs
SELECT 'Test 4.2: Admin updating HoneyBook job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- UPDATE jobs SET title = 'Admin Updated HoneyBook Job' WHERE id = 'job_a2_id' RETURNING id, title;
-- Expected: Update succeeds

-- Test 4.3: Admin should be able to delete any job, including HoneyBook jobs
SELECT 'Test 4.3: Admin deleting HoneyBook job' as test_name;
-- Uncomment to test (replace with actual job ID):
-- DELETE FROM jobs WHERE id = 'job_a2_id' RETURNING id;
-- Expected: Delete succeeds

-- ==========================================
-- IMPORTANT NOTES
-- ==========================================
-- 1. This script only tests RLS policies and does not modify any data by default
-- 2. To test modifications, uncomment the relevant UPDATE/DELETE statements
-- 3. Replace the UUIDs with actual values from your database
-- 4. Replace the placeholder UUIDs with actual values from your database before running

-- Reset role
RESET ROLE;
RESET "request.jwt.claims";