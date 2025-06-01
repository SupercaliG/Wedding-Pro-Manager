"use server";

/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please import from "./actions/jobs" instead.
 */

import { hasTimeConflict } from "../utils/timeUtils";

import { createJob as originalCreateJob } from "./actions/jobs/create";
import {
  getJobsByOrg as originalGetJobsByOrg,
  getJobById as originalGetJobById,
  getAvailableJobsForEmployee as originalGetAvailableJobsForEmployee,
  getEmployeeAssignments as originalGetEmployeeAssignments
} from "./actions/jobs/fetch";
import {
  updateJob as originalUpdateJob,
  deleteJob as originalDeleteJob,
  markJobAsComplete as originalMarkJobAsComplete
} from "./actions/jobs/update";

// Create async wrapper functions instead of direct re-exports
export async function createJob(...args: Parameters<typeof originalCreateJob>) {
  return await originalCreateJob(...args);
}

export async function getJobsByOrg(...args: Parameters<typeof originalGetJobsByOrg>) {
  return await originalGetJobsByOrg(...args);
}

export async function getJobById(...args: Parameters<typeof originalGetJobById>) {
  return await originalGetJobById(...args);
}

export async function updateJob(...args: Parameters<typeof originalUpdateJob>) {
  return await originalUpdateJob(...args);
}

export async function deleteJob(...args: Parameters<typeof originalDeleteJob>) {
  return await originalDeleteJob(...args);
}

export async function getAvailableJobsForEmployee(...args: Parameters<typeof originalGetAvailableJobsForEmployee>) {
  return await originalGetAvailableJobsForEmployee(...args);
}

export async function getEmployeeAssignments(...args: Parameters<typeof originalGetEmployeeAssignments>) {
  return await originalGetEmployeeAssignments(...args);
}

export async function markJobAsComplete(...args: Parameters<typeof originalMarkJobAsComplete>) {
  return await originalMarkJobAsComplete(...args);
}
