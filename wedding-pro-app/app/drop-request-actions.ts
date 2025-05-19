"use server";

// Re-export everything from the new location to maintain backward compatibility
export * from "./actions/drop-requests";

// Add a deprecation warning comment for developers
/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please import from "./actions/drop-requests" instead.
 */