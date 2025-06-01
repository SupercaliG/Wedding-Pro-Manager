/**
 * Checks if two time intervals overlap (conflict).
 * Returns true if there is a conflict, false otherwise.
 */
export function hasTimeConflict(
  event1StartTime: string,
  event1EndTime: string,
  event2StartTime: string,
  event2EndTime: string
): boolean {
  const startA = new Date(event1StartTime).getTime();
  const endA = new Date(event1EndTime).getTime();
  const startB = new Date(event2StartTime).getTime();
  const endB = new Date(event2EndTime).getTime();
  return startA < endB && startB < endA;
}