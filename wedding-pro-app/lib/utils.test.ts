import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    // Test with simple strings
    expect(cn('class1', 'class2')).toBe('class1 class2');
    
    // Test with conditional classes
    expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class');
    expect(cn('base-class', false && 'conditional-class')).toBe('base-class');
    
    // Test with object notation
    expect(cn('base-class', { 'active': true, 'disabled': false })).toBe('base-class active');
    
    // Test with array
    expect(cn('base-class', ['array-class1', 'array-class2'])).toBe('base-class array-class1 array-class2');
    
    // Test with Tailwind classes that should be merged
    expect(cn('p-4 bg-red-500', 'p-8')).toBe('bg-red-500 p-8');
  });
});