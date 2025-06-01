"use server";

import {
  approveDropRequest,
  rejectDropRequest,
  createDropRequest,
  getDropRequestsForEmployee,
  getDropRequestsForManager,
  getDropRequestsForAdmin
} from "./actions/drop-requests";

/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please import from "./actions/drop-requests" instead.
 */

// Re-export all drop request actions for compatibility with legacy imports
export { approveDropRequest, rejectDropRequest, createDropRequest, getDropRequestsForEmployee, getDropRequestsForManager, getDropRequestsForAdmin };