'use client';

import React from 'react';
import Link from 'next/link';
import { VenueWithLocation } from '@/app/venue-actions';
import { TagData } from '@/app/venue-actions';
import { PinIcon, MapPinIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VenueCardProps {
  venue: VenueWithLocation;
  onPin: (venueId: string) => Promise<void>;
  onUnpin: (venueId: string) => Promise<void>;
  isPinning: boolean;
}

export function VenueCard({ venue, onPin, onUnpin, isPinning }: VenueCardProps) {
  const handlePinToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPinning) return; // Prevent multiple clicks while processing
    
    try {
      if (venue.is_pinned) {
        await onUnpin(venue.id);
      } else {
        await onPin(venue.id);
      }
    } catch (error) {
      console.error('Error toggling pin status:', error);
    }
  };

  return (
    <Link 
      href={`/dashboard/manager/venues/${venue.id}`}
      className={cn(
        'block p-4 rounded-lg border transition-all',
        venue.is_pinned 
          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/50'
      )}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{venue.name}</h3>
        <button 
          onClick={handlePinToggle}
          disabled={isPinning}
          className={cn(
            'p-1.5 rounded-full transition-colors',
            venue.is_pinned 
              ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/50' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700/50'
          )}
          aria-label={venue.is_pinned ? "Unpin venue" : "Pin venue"}
          title={venue.is_pinned ? "Unpin venue" : "Pin venue"}
        >
          {venue.is_pinned ? (
            <PinIcon className="h-5 w-5" />
          ) : (
            <PinIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {venue.location && (
        <div className="mt-2 flex items-start text-sm text-gray-600 dark:text-gray-400">
          <MapPinIcon className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
          <span>
            {venue.location.city && venue.location.state_province 
              ? `${venue.location.city}, ${venue.location.state_province}` 
              : venue.location.city || venue.location.state_province || 'Location not specified'}
          </span>
        </div>
      )}
      
      {venue.description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {venue.description}
        </p>
      )}
      
      {venue.tags && venue.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {venue.tags.map((tagObj: any) => (
            <span
              key={tagObj.tag?.id || 'unknown'}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              {tagObj.tag?.name || 'Unknown Tag'}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}