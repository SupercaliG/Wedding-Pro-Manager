'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { VenueWithLocation, pinVenue, unpinVenue } from '@/app/venue-actions';
import { VenueCard } from '@/components/venues/venue-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinIcon, SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface VenuesClientProps {
  initialVenues: VenueWithLocation[];
  initialPinnedVenues: VenueWithLocation[];
}

export function VenuesClient({ initialVenues, initialPinnedVenues }: VenuesClientProps) {
  const [venues, setVenues] = useState<VenueWithLocation[]>(initialVenues);
  const [pinnedVenues, setPinnedVenues] = useState<VenueWithLocation[]>(initialPinnedVenues);
  const [isPinning, setIsPinning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter venues based on search query
  const filteredVenues = useMemo(() => {
    if (!searchQuery.trim()) return venues;
    
    const query = searchQuery.toLowerCase();
    return venues.filter(venue => 
      venue.name.toLowerCase().includes(query) || 
      venue.description?.toLowerCase().includes(query) ||
      venue.location?.city?.toLowerCase().includes(query) ||
      venue.location?.state_province?.toLowerCase().includes(query)
    );
  }, [venues, searchQuery]);
  
  const filteredPinnedVenues = useMemo(() => {
    if (!searchQuery.trim()) return pinnedVenues;
    
    const query = searchQuery.toLowerCase();
    return pinnedVenues.filter(venue => 
      venue.name.toLowerCase().includes(query) || 
      venue.description?.toLowerCase().includes(query) ||
      venue.location?.city?.toLowerCase().includes(query) ||
      venue.location?.state_province?.toLowerCase().includes(query)
    );
  }, [pinnedVenues, searchQuery]);

  // Handle pinning a venue
  const handlePinVenue = useCallback(async (venueId: string) => {
    setIsPinning(true);
    
    try {
      const formData = new FormData();
      formData.append('venueId', venueId);
      
      await pinVenue(formData);
      
      // Update local state
      setVenues(prev => prev.map(venue => 
        venue.id === venueId ? { ...venue, is_pinned: true } : venue
      ));
      
      // Add to pinned venues if not already there
      const venueToPin = venues.find(v => v.id === venueId);
      if (venueToPin && !pinnedVenues.some(v => v.id === venueId)) {
        setPinnedVenues(prev => [...prev, { ...venueToPin, is_pinned: true }]);
      }
    } catch (error) {
      console.error('Error pinning venue:', error);
    } finally {
      setIsPinning(false);
    }
  }, [venues, pinnedVenues]);

  // Handle unpinning a venue
  const handleUnpinVenue = useCallback(async (venueId: string) => {
    setIsPinning(true);
    
    try {
      const formData = new FormData();
      formData.append('venueId', venueId);
      
      await unpinVenue(formData);
      
      // Update local state
      setVenues(prev => prev.map(venue => 
        venue.id === venueId ? { ...venue, is_pinned: false } : venue
      ));
      
      // Remove from pinned venues
      setPinnedVenues(prev => prev.filter(venue => venue.id !== venueId));
    } catch (error) {
      console.error('Error unpinning venue:', error);
    } finally {
      setIsPinning(false);
    }
  }, []);

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search venues by name, description, or location..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Venues ({filteredVenues.length})</TabsTrigger>
          <TabsTrigger value="pinned" className="flex items-center">
            <PinIcon className="h-4 w-4 mr-1" />
            Pinned ({filteredPinnedVenues.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          {filteredVenues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVenues.map(venue => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  onPin={handlePinVenue}
                  onUnpin={handleUnpinVenue}
                  isPinning={isPinning}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchQuery ? (
                <p>No venues match your search criteria.</p>
              ) : (
                <p>No venues found. Add your first venue to get started.</p>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="pinned">
          {filteredPinnedVenues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPinnedVenues.map(venue => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  onPin={handlePinVenue}
                  onUnpin={handleUnpinVenue}
                  isPinning={isPinning}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchQuery ? (
                <p>No pinned venues match your search criteria.</p>
              ) : (
                <p>No pinned venues. Pin venues to access them quickly.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}