/**
 * Parse distance range from string (e.g., "0-5", "10+", "<20")
 */
export function parseDistanceRange(distanceStr: string): { min: number | null; max: number | null } | null {
  try {
    if (distanceStr.includes('-')) {
      // Range format: "0-5"
      const [min, max] = distanceStr.split('-').map(Number);
      return { min, max };
    } else if (distanceStr.startsWith('<')) {
      // Less than format: "<20"
      const max = Number(distanceStr.substring(1));
      return { min: null, max };
    } else if (distanceStr.startsWith('>') || distanceStr.endsWith('+')) {
      // Greater than format: ">10" or "10+"
      const min = Number(distanceStr.replace(/[>+]/g, ''));
      return { min, max: null };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing distance range:", error);
    return null;
  }
}