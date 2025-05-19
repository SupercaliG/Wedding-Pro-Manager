'use client';

import React from 'react';
import { VenueWithLocation } from '@/app/venue-actions';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { PinIcon, MapPinIcon, CarIcon, FileTextIcon, InfoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VenueDetailProps {
  venue: VenueWithLocation;
  onPin: (venueId: string) => Promise<void>;
  onUnpin: (venueId: string) => Promise<void>;
  isPinning: boolean;
}

export function VenueDetail({ venue, onPin, onUnpin, isPinning }: VenueDetailProps) {
  const handlePinToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{venue.name}</h1>
          <button 
            onClick={handlePinToggle}
            disabled={isPinning}
            className={cn(
              'p-2 rounded-full transition-colors',
              venue.is_pinned 
                ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700/50'
            )}
            aria-label={venue.is_pinned ? "Unpin venue" : "Pin venue"}
            title={venue.is_pinned ? "Unpin venue" : "Pin venue"}
          >
            <PinIcon className="h-6 w-6" />
          </button>
        </div>
        
        {venue.location && (
          <div className="mt-2 flex items-start text-gray-600 dark:text-gray-400">
            <MapPinIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              {venue.location.address_line1 && <div>{venue.location.address_line1}</div>}
              {venue.location.address_line2 && <div>{venue.location.address_line2}</div>}
              <div>
                {[
                  venue.location.city,
                  venue.location.state_province,
                  venue.location.postal_code,
                  venue.location.country
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        )}
        
        {venue.tags && venue.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {venue.tags.map((tagObj: any) => (
              <span 
                key={tagObj.tag?.id || 'unknown'} 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {tagObj.tag?.name || 'Unknown Tag'}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Description */}
      {venue.description && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Description</h2>
          <MarkdownRenderer content={venue.description} />
        </div>
      )}
      
      {/* Parking Tips */}
      {venue.parking_tips && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <CarIcon className="h-5 w-5 mr-2" />
            Parking Tips
          </h2>
          <MarkdownRenderer content={venue.parking_tips} />
        </div>
      )}
      
      {/* Permit Information */}
      {venue.permit_info && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <FileTextIcon className="h-5 w-5 mr-2" />
            Permit Information
          </h2>
          <MarkdownRenderer content={venue.permit_info} />
        </div>
      )}
      
      {/* Markdown Tips */}
      {venue.markdown_tips && (
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <InfoIcon className="h-5 w-5 mr-2" />
            Additional Information
          </h2>
          <MarkdownRenderer content={venue.markdown_tips} />
        </div>
      )}
    </div>
  );
}