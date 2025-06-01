"use server";

// This file re-exports all public actions, types, and utilities
// related to jobs, organizing them into more manageable modules.

// Re-export actions from their respective modules
export { createJob } from './create';
export { getJobsByOrg, getJobById, getAvailableJobsForEmployee, getEmployeeAssignments } from './fetch';
export { updateJob, deleteJob, markJobAsComplete } from './update';
// export * from './assignment'; // Add when assignment.ts is created
// export * from './interest'; // Add when interest.ts is created

// Re-export utility functions.
// Consider if direct imports to ./utils are preferred in consuming modules.
export * from './utils';

// Re-export notification functions.
// Consider if direct imports to ./notifications are preferred.
export * from './notifications';

// Re-export client-side utility functions.
// Consider if direct imports to ./client-utils are preferred.
export * from './client-utils';

// Re-export all types from the dedicated types module
export * from './types';