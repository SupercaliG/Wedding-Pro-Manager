import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVenueById } from '@/app/venue-actions';
import { VenueDetailClient } from './venue-detail-client';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from 'lucide-react';

interface VenueDetailPageProps {
  params: {
    venueId: string;
  };
}

export async function generateMetadata({ params }: VenueDetailPageProps) {
  const { data: venue, error } = await getVenueById(params.venueId);
  
  if (error || !venue) {
    return {
      title: 'Venue Not Found - Wedding Pro',
      description: 'The requested venue could not be found',
    };
  }
  
  return {
    title: `${venue.name} - Venues - Wedding Pro`,
    description: venue.description || 'Venue details',
  };
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
  const { data: venue, error } = await getVenueById(params.venueId);
  
  if (error || !venue) {
    notFound();
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/dashboard/manager/venues">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Venues
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{venue.name}</h1>
        </div>
        
        <div className="flex space-x-2">
          <Link href={`/dashboard/manager/venues/${venue.id}/edit`}>
            <Button variant="outline" size="sm" className="flex items-center">
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          
          <form action="/api/venues/delete" method="POST">
            <input type="hidden" name="venueId" value={venue.id} />
            <Button variant="destructive" size="sm" className="flex items-center">
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </form>
        </div>
      </div>
      
      <VenueDetailClient venue={venue} />
    </div>
  );
}