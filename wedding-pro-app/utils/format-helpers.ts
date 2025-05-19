/**
 * Utility functions for formatting data for display
 */

/**
 * Format a PostgreSQL interval string into a human-readable format
 * @param intervalString The PostgreSQL interval string
 * @returns A human-readable string representation of the interval
 */
export function formatInterval(intervalString: string | null): string {
  if (!intervalString) return 'N/A';
  
  try {
    // Parse the interval string
    // Example: "3 days 02:12:00" or "00:45:30"
    const parts = intervalString.trim().split(' ');
    
    let days = 0;
    let timeString = '';
    
    if (parts.length > 1) {
      // Has days component
      days = parseInt(parts[0], 10);
      timeString = parts[parts.length - 1];
    } else {
      // Only has time component
      timeString = parts[0];
    }
    
    // Parse time component (HH:MM:SS)
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    // Build human-readable string
    const components = [];
    
    if (days > 0) {
      components.push(`${days} day${days !== 1 ? 's' : ''}`);
    }
    
    if (hours > 0) {
      components.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    
    if (minutes > 0) {
      components.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
    
    if (components.length === 0) {
      return 'Less than a minute';
    }
    
    return components.join(', ');
  } catch (error) {
    console.error('Error formatting interval:', error);
    return intervalString; // Return the original string if parsing fails
  }
}