'use client';

import React, { useState } from 'react';
import { VenueWithLocation, pinVenue, unpinVenue } from '@/app/venue-actions';
import { VenueDetail } from '@/components/venues/venue-detail';
import { useRouter } from 'next/navigation';

interface VenueDetailClientProps {
  venue: VenueWithLocation;
}

export function VenueDetailClient({ venue }: VenueDetailClientProps) {
  const [isPinning, setIsPinning] = useState(false);
  const [currentVenue, setCurrentVenue] = useState<VenueWithLocation>(venue);
  const router = useRouter();

  const handlePinVenue = async (venueId: string) => {
    setIsPinning(true);
    
    try {
      const formData = new FormData();
      formData.append('venueId', venueId);
      
      await pinVenue(formData);
      
      // Update local state
      setCurrentVenue(prev => ({ ...prev, is_pinned: true }));
      
      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Error pinning venue:', error);
    } finally {
      setIsPinning(false);
    }
  };

  const handleUnpinVenue = async (venueId: string) => {
    setIsPinning(true);
    
    try {
      const formData = new FormData();
      formData.append('venueId', venueId);
      
      await unpinVenue(formData);
      
      // Update local state
      setCurrentVenue(prev => ({ ...prev, is_pinned: false }));
      
      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Error unpinning venue:', error);
    } finally {
      setIsPinning(false);
    }
  };

  return (
    <VenueDetail
      venue={currentVenue}
      onPin={handlePinVenue}
      onUnpin={handleUnpinVenue}
      isPinning={isPinning}
    />
  );
}