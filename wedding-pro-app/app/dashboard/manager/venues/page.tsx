import React from 'react';
import Link from 'next/link';
import { getVenues, getPinnedVenues } from '@/app/venue-actions';
import { VenuesClient } from './venues-client';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';

export const metadata = {
  title: 'Venue Management - Wedding Pro',
  description: 'Manage your venues and locations',
};

export default async function VenuesPage() {
  // Get all venues
  const { data: allVenues, error: venuesError } = await getVenues();
  
  // Get pinned venues
  const { data: pinnedVenues, error: pinnedError } = await getPinnedVenues();
  
  if (venuesError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Venues</h1>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-800 dark:text-red-200">
          Error loading venues: {venuesError}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Venues</h1>
        <Link href="/dashboard/manager/venues/new">
          <Button className="flex items-center">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Venue
          </Button>
        </Link>
      </div>
      
      <VenuesClient 
        initialVenues={allVenues || []} 
        initialPinnedVenues={pinnedVenues || []} 
      />
    </div>
  );
}