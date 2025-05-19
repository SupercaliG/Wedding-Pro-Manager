"use server";

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { revalidatePath } from "next/cache";
import { encodedRedirect } from "@/utils/utils";

// Types
export type VenueData = {
  name: string;
  description?: string | null;
  parking_tips?: string | null;
  permit_info?: string | null;
  markdown_tips?: string | null;
};

export type VenueWithLocation = VenueData & {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  location?: LocationData | null;
  tags?: TagData[] | null;
  is_pinned?: boolean;
};

export type LocationData = {
  id: string;
  venue_id: string;
  organization_id: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
};

export type TagData = {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

/**
 * Create a new venue with optional location
 */
export async function createVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract venue form data
  const name = formData.get("name")?.toString();
  const description = formData.get("description")?.toString();
  const parkingTips = formData.get("parking_tips")?.toString();
  const permitInfo = formData.get("permit_info")?.toString();
  const markdownTips = formData.get("markdown_tips")?.toString();
  
  // Extract location form data
  const addressLine1 = formData.get("address_line1")?.toString();
  const addressLine2 = formData.get("address_line2")?.toString();
  const city = formData.get("city")?.toString();
  const stateProvince = formData.get("state_province")?.toString();
  const postalCode = formData.get("postal_code")?.toString();
  const country = formData.get("country")?.toString();
  const latitude = formData.get("latitude")?.toString();
  const longitude = formData.get("longitude")?.toString();
  
  // Validate required fields
  if (!name) {
    return encodedRedirect(
      "error",
      "/dashboard/venues/new",
      "Venue name is required"
    );
  }
  
  try {
    // Start a transaction
    const { data, error } = await supabase.rpc('create_venue_with_location', {
      venue_name: name,
      venue_description: description || null,
      venue_parking_tips: parkingTips || null,
      venue_permit_info: permitInfo || null,
      venue_markdown_tips: markdownTips || null,
      venue_organization_id: profile.org_id,
      venue_created_by: user.id,
      location_address_line1: addressLine1 || null,
      location_address_line2: addressLine2 || null,
      location_city: city || null,
      location_state_province: stateProvince || null,
      location_postal_code: postalCode || null,
      location_country: country || null,
      location_latitude: latitude ? parseFloat(latitude) : null,
      location_longitude: longitude ? parseFloat(longitude) : null
    });
    
    if (error) {
      console.error("Error creating venue:", error);
      return encodedRedirect("error", "/dashboard/venues/new", error.message);
    }
    
    revalidatePath('/dashboard/venues');
    return encodedRedirect("success", "/dashboard/venues", "Venue created successfully");
  } catch (error) {
    console.error("Error creating venue:", error);
    return encodedRedirect("error", "/dashboard/venues/new", "An unexpected error occurred");
  }
}

/**
 * Get all venues for the current user's organization
 */
export async function getVenues() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Get venues with their locations
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      location:locations (
        id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude
      ),
      tags:venue_tags (
        tag:tag_id (
          id, name
        )
      )
    `)
    .eq('organization_id', profile.org_id);
  
  if (error) {
    console.error("Error fetching venues:", error);
    return { error: "Failed to fetch venues" };
  }
  
  // Check if user has pinned any of these venues
  const { data: userPins, error: pinsError } = await supabase
    .from('user_pins')
    .select('venue_id')
    .eq('user_id', user.id);
  
  if (pinsError) {
    console.error("Error fetching user pins:", pinsError);
  }
  
  // Format the data to include whether each venue is pinned
  const pinnedVenueIds = userPins ? userPins.map(pin => pin.venue_id) : [];
  const venuesWithPinStatus = data.map(venue => ({
    ...venue,
    is_pinned: pinnedVenueIds.includes(venue.id)
  }));
  
  return { data: venuesWithPinStatus as VenueWithLocation[] };
}

/**
 * Get a venue by ID
 */
export async function getVenueById(venueId: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { error: "Profile not found" };
  }
  
  // Get venue with its location
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      location:locations (
        id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude
      ),
      tags:venue_tags (
        tag:tag_id (
          id, name
        )
      )
    `)
    .eq('id', venueId)
    .single();
  
  if (error) {
    console.error("Error fetching venue:", error);
    return { error: "Failed to fetch venue" };
  }
  
  // Check if user has access to this venue
  if (profile.role !== 'Admin' && data.organization_id !== profile.org_id) {
    return { error: "You don't have access to this venue" };
  }
  
  // Check if user has pinned this venue
  const { data: userPin, error: pinError } = await supabase
    .from('user_pins')
    .select('id')
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .maybeSingle();
  
  if (pinError) {
    console.error("Error checking if venue is pinned:", pinError);
  }
  
  return { 
    data: { 
      ...data, 
      is_pinned: !!userPin 
    } as VenueWithLocation 
  };
}

/**
 * Update a venue and its location
 */
export async function updateVenue(venueId: string, formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Get the venue to verify ownership
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('organization_id')
    .eq('id', venueId)
    .single();
  
  if (venueError || !venue) {
    return encodedRedirect("error", `/dashboard/venues`, "Venue not found");
  }
  
  // Verify the venue belongs to the user's organization
  if (venue.organization_id !== profile.org_id) {
    return encodedRedirect("error", "/dashboard/venues", "You can only update venues in your organization");
  }
  
  // Extract venue form data
  const name = formData.get("name")?.toString();
  const description = formData.get("description")?.toString();
  const parkingTips = formData.get("parking_tips")?.toString();
  const permitInfo = formData.get("permit_info")?.toString();
  const markdownTips = formData.get("markdown_tips")?.toString();
  
  // Extract location form data
  const locationId = formData.get("location_id")?.toString();
  const addressLine1 = formData.get("address_line1")?.toString();
  const addressLine2 = formData.get("address_line2")?.toString();
  const city = formData.get("city")?.toString();
  const stateProvince = formData.get("state_province")?.toString();
  const postalCode = formData.get("postal_code")?.toString();
  const country = formData.get("country")?.toString();
  const latitude = formData.get("latitude")?.toString();
  const longitude = formData.get("longitude")?.toString();
  
  // Validate required fields
  if (!name) {
    return encodedRedirect(
      "error",
      `/dashboard/venues/${venueId}/edit`,
      "Venue name is required"
    );
  }
  
  try {
    // Start a transaction
    const { error } = await supabase.rpc('update_venue_with_location', {
      venue_id: venueId,
      venue_name: name,
      venue_description: description || null,
      venue_parking_tips: parkingTips || null,
      venue_permit_info: permitInfo || null,
      venue_markdown_tips: markdownTips || null,
      venue_updated_by: user.id,
      location_id: locationId || null,
      location_address_line1: addressLine1 || null,
      location_address_line2: addressLine2 || null,
      location_city: city || null,
      location_state_province: stateProvince || null,
      location_postal_code: postalCode || null,
      location_country: country || null,
      location_latitude: latitude ? parseFloat(latitude) : null,
      location_longitude: longitude ? parseFloat(longitude) : null
    });
    
    if (error) {
      console.error("Error updating venue:", error);
      return encodedRedirect("error", `/dashboard/venues/${venueId}/edit`, error.message);
    }
    
    revalidatePath('/dashboard/venues');
    revalidatePath(`/dashboard/venues/${venueId}`);
    return encodedRedirect("success", "/dashboard/venues", "Venue updated successfully");
  } catch (error) {
    console.error("Error updating venue:", error);
    return encodedRedirect("error", `/dashboard/venues/${venueId}/edit`, "An unexpected error occurred");
  }
}

/**
 * Delete a venue
 */
export async function deleteVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract venue ID
  const venueId = formData.get("venueId")?.toString();
  if (!venueId) {
    return encodedRedirect("error", "/dashboard/venues", "Venue ID is required");
  }
  
  // Get the venue to verify ownership
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('organization_id')
    .eq('id', venueId)
    .single();
  
  if (venueError || !venue) {
    return encodedRedirect("error", "/dashboard/venues", "Venue not found");
  }
  
  // Verify the venue belongs to the user's organization
  if (venue.organization_id !== profile.org_id) {
    return encodedRedirect("error", "/dashboard/venues", "You can only delete venues in your organization");
  }
  
  try {
    // Delete venue (cascade will handle related records)
    const { error } = await supabase
      .from('venues')
      .delete()
      .eq('id', venueId);
    
    if (error) {
      console.error("Error deleting venue:", error);
      return encodedRedirect("error", "/dashboard/venues", error.message);
    }
    
    revalidatePath('/dashboard/venues');
    return encodedRedirect("success", "/dashboard/venues", "Venue deleted successfully");
  } catch (error) {
    console.error("Error deleting venue:", error);
    return encodedRedirect("error", "/dashboard/venues", "An unexpected error occurred");
  }
}

/**
 * Search venues by name, description, or location
 * @deprecated Use searchAndFilterVenues instead for more advanced search capabilities
 */
export async function searchVenues(query: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Search venues
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      location:locations (
        id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude
      ),
      tags:venue_tags (
        tag:tag_id (
          id, name
        )
      )
    `)
    .eq('organization_id', profile.org_id)
    .textSearch('name', query, {
      type: 'websearch',
      config: 'english'
    });
  
  if (error) {
    console.error("Error searching venues:", error);
    return { error: "Failed to search venues" };
  }
  
  // Check if user has pinned any of these venues
  const { data: userPins, error: pinsError } = await supabase
    .from('user_pins')
    .select('venue_id')
    .eq('user_id', user.id);
  
  if (pinsError) {
    console.error("Error fetching user pins:", pinsError);
  }
  
  // Format the data to include whether each venue is pinned
  const pinnedVenueIds = userPins ? userPins.map(pin => pin.venue_id) : [];
  const venuesWithPinStatus = data.map(venue => ({
    ...venue,
    is_pinned: pinnedVenueIds.includes(venue.id)
  }));
  
  return { data: venuesWithPinStatus as VenueWithLocation[] };
}

/**
 * Search and filter venues with advanced options
 *
 * @param options Search and filter options
 * @param options.searchQuery Optional search query to search across venue fields
 * @param options.locationFilters Optional filters for location attributes
 * @param options.tagIds Optional array of tag IDs to filter by
 * @param options.pinnedOnly Optional flag to show only venues pinned by the current user
 * @param options.limit Optional limit for the number of results (default: 50)
 * @param options.offset Optional offset for pagination (default: 0)
 * @returns Filtered venues with location, tags, and pin status
 */
export async function searchAndFilterVenues({
  searchQuery,
  locationFilters,
  tagIds,
  pinnedOnly,
  limit = 50,
  offset = 0
}: {
  searchQuery?: string;
  locationFilters?: {
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  tagIds?: string[];
  pinnedOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }

  // Start building the query
  let query = supabase
    .from('venues')
    .select(`
      *,
      location:locations (
        id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude
      ),
      tags:venue_tags (
        tag:tag_id (
          id, name
        )
      )
    `, { count: 'exact' })
    .eq('organization_id', profile.org_id)
    .range(offset, offset + limit - 1);

  // Apply full-text search if a search query is provided
  if (searchQuery && searchQuery.trim() !== '') {
    query = query.textSearch(
      'name || description || parking_tips || permit_info || markdown_tips',
      searchQuery,
      {
        type: 'websearch',
        config: 'english'
      }
    );
  }

  // Get user pins first if we need to filter by pinned status
  let pinnedVenueIds: string[] = [];
  if (pinnedOnly) {
    const { data: userPins, error: pinsError } = await supabase
      .from('user_pins')
      .select('venue_id')
      .eq('user_id', user.id);
    
    if (pinsError) {
      console.error("Error fetching user pins:", pinsError);
      return { error: "Failed to fetch user pins" };
    }
    
    pinnedVenueIds = userPins ? userPins.map(pin => pin.venue_id) : [];
    
    // If pinnedOnly is true but user has no pins, return empty result
    if (pinnedVenueIds.length === 0) {
      return { data: [], count: 0 };
    }
    
    // Filter venues by pinned IDs
    query = query.in('id', pinnedVenueIds);
  }

  // Execute the query
  const { data, error, count } = await query;
  
  if (error) {
    console.error("Error searching venues:", error);
    return { error: "Failed to search venues" };
  }

  // If we have location filters, apply them post-query
  let filteredData = data;
  
  if (locationFilters) {
    filteredData = filteredData.filter(venue => {
      const location = venue.location;
      if (!location) return false;
      
      // Check each location filter
      if (locationFilters.city && location.city !== locationFilters.city) {
        return false;
      }
      if (locationFilters.stateProvince && location.state_province !== locationFilters.stateProvince) {
        return false;
      }
      if (locationFilters.postalCode && location.postal_code !== locationFilters.postalCode) {
        return false;
      }
      if (locationFilters.country && location.country !== locationFilters.country) {
        return false;
      }
      
      return true;
    });
  }
  
  // If we have tag filters, apply them post-query
  if (tagIds && tagIds.length > 0) {
    filteredData = filteredData.filter(venue => {
      if (!venue.tags || venue.tags.length === 0) return false;
      
      // Check if venue has all the required tags
      const venueTags = venue.tags.map((tagObj: { tag: { id: string } }) => tagObj.tag.id);
      return tagIds.every(tagId => venueTags.includes(tagId));
    });
  }
  
  // If we didn't filter by pinnedOnly earlier, we need to check pin status
  if (!pinnedOnly) {
    // Fetch user pins if we haven't already
    if (pinnedVenueIds.length === 0) {
      const { data: userPins, error: pinsError } = await supabase
        .from('user_pins')
        .select('venue_id')
        .eq('user_id', user.id);
      
      if (pinsError) {
        console.error("Error fetching user pins:", pinsError);
      } else {
        pinnedVenueIds = userPins ? userPins.map(pin => pin.venue_id) : [];
      }
    }
  }
  
  // Format the data to include whether each venue is pinned
  const venuesWithPinStatus = filteredData.map(venue => ({
    ...venue,
    is_pinned: pinnedVenueIds.includes(venue.id)
  }));
  
  return {
    data: venuesWithPinStatus as VenueWithLocation[],
    count: filteredData.length
  };
}

/**
 * Create a new tag
 */
export async function createTag(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract tag name
  const name = formData.get("name")?.toString();
  if (!name) {
    return encodedRedirect("error", "/dashboard/venues/tags", "Tag name is required");
  }
  
  try {
    // Insert tag
    const { error } = await supabase
      .from('tags')
      .insert([
        {
          name,
          organization_id: profile.org_id
        }
      ]);
    
    if (error) {
      console.error("Error creating tag:", error);
      return encodedRedirect("error", "/dashboard/venues/tags", error.message);
    }
    
    revalidatePath('/dashboard/venues/tags');
    return encodedRedirect("success", "/dashboard/venues/tags", "Tag created successfully");
  } catch (error) {
    console.error("Error creating tag:", error);
    return encodedRedirect("error", "/dashboard/venues/tags", "An unexpected error occurred");
  }
}

/**
 * Get all tags for the current user's organization
 */
export async function getTags() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Get tags
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('organization_id', profile.org_id);
  
  if (error) {
    console.error("Error fetching tags:", error);
    return { error: "Failed to fetch tags" };
  }
  
  return { data: data as TagData[] };
}

/**
 * Delete a tag
 */
export async function deleteTag(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract tag ID
  const tagId = formData.get("tagId")?.toString();
  if (!tagId) {
    return encodedRedirect("error", "/dashboard/venues/tags", "Tag ID is required");
  }
  
  // Get the tag to verify ownership
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('organization_id')
    .eq('id', tagId)
    .single();
  
  if (tagError || !tag) {
    return encodedRedirect("error", "/dashboard/venues/tags", "Tag not found");
  }
  
  // Verify the tag belongs to the user's organization
  if (tag.organization_id !== profile.org_id) {
    return encodedRedirect("error", "/dashboard/venues/tags", "You can only delete tags in your organization");
  }
  
  try {
    // Delete tag
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);
    
    if (error) {
      console.error("Error deleting tag:", error);
      return encodedRedirect("error", "/dashboard/venues/tags", error.message);
    }
    
    revalidatePath('/dashboard/venues/tags');
    return encodedRedirect("success", "/dashboard/venues/tags", "Tag deleted successfully");
  } catch (error) {
    console.error("Error deleting tag:", error);
    return encodedRedirect("error", "/dashboard/venues/tags", "An unexpected error occurred");
  }
}

/**
 * Get available location filters for the current user's organization
 * Returns unique values for city, state_province, postal_code, and country
 */
export async function getLocationFilters() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Get unique cities
  const { data: cities, error: citiesError } = await supabase
    .from('locations')
    .select('city')
    .eq('organization_id', profile.org_id)
    .not('city', 'is', null)
    .order('city');
  
  if (citiesError) {
    console.error("Error fetching cities:", citiesError);
    return { error: "Failed to fetch location filters" };
  }
  
  // Get unique states/provinces
  const { data: states, error: statesError } = await supabase
    .from('locations')
    .select('state_province')
    .eq('organization_id', profile.org_id)
    .not('state_province', 'is', null)
    .order('state_province');
  
  if (statesError) {
    console.error("Error fetching states:", statesError);
    return { error: "Failed to fetch location filters" };
  }
  
  // Get unique postal codes
  const { data: postalCodes, error: postalCodesError } = await supabase
    .from('locations')
    .select('postal_code')
    .eq('organization_id', profile.org_id)
    .not('postal_code', 'is', null)
    .order('postal_code');
  
  if (postalCodesError) {
    console.error("Error fetching postal codes:", postalCodesError);
    return { error: "Failed to fetch location filters" };
  }
  
  // Get unique countries
  const { data: countries, error: countriesError } = await supabase
    .from('locations')
    .select('country')
    .eq('organization_id', profile.org_id)
    .not('country', 'is', null)
    .order('country');
  
  if (countriesError) {
    console.error("Error fetching countries:", countriesError);
    return { error: "Failed to fetch location filters" };
  }
  
  // Remove duplicates and extract values
  const uniqueCities = Array.from(new Set(cities.map(item => item.city)));
  const uniqueStates = Array.from(new Set(states.map(item => item.state_province)));
  const uniquePostalCodes = Array.from(new Set(postalCodes.map(item => item.postal_code)));
  const uniqueCountries = Array.from(new Set(countries.map(item => item.country)));
  
  return {
    data: {
      cities: uniqueCities,
      states: uniqueStates,
      postalCodes: uniquePostalCodes,
      countries: uniqueCountries
    }
  };
}

/**
 * Get all available tags for filtering venues
 * This extends the existing getTags function with additional metadata
 * about how many venues are tagged with each tag
 */
export async function getTagsWithCount() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // Get all tags for the organization
  const { data: tags, error } = await supabase
    .from('tags')
    .select('*')
    .eq('organization_id', profile.org_id)
    .order('name');
  
  if (error) {
    console.error("Error fetching tags:", error);
    return { error: "Failed to fetch tags" };
  }
  
  // For each tag, count how many venues are tagged with it
  const tagsWithCount = await Promise.all(
    tags.map(async (tag) => {
      const { count, error: countError } = await supabase
        .from('venue_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id)
        .eq('organization_id', profile.org_id);
      
      if (countError) {
        console.error(`Error counting venues for tag ${tag.id}:`, countError);
        return { ...tag, venueCount: 0 };
      }
      
      return { ...tag, venueCount: count || 0 };
    })
  );
  
  return { data: tagsWithCount };
}

/**
 * Add a tag to a venue
 */
export async function addTagToVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract venue ID and tag ID
  const venueId = formData.get("venueId")?.toString();
  const tagId = formData.get("tagId")?.toString();
  
  if (!venueId || !tagId) {
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "Venue ID and Tag ID are required");
  }
  
  try {
    // Insert venue_tag
    const { error } = await supabase
      .from('venue_tags')
      .insert([
        {
          venue_id: venueId,
          tag_id: tagId,
          organization_id: profile.org_id
        }
      ]);
    
    if (error) {
      console.error("Error adding tag to venue:", error);
      return encodedRedirect("error", `/dashboard/venues/${venueId}`, error.message);
    }
    
    revalidatePath(`/dashboard/venues/${venueId}`);
    return encodedRedirect("success", `/dashboard/venues/${venueId}`, "Tag added to venue successfully");
  } catch (error) {
    console.error("Error adding tag to venue:", error);
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "An unexpected error occurred");
  }
}

/**
 * Remove a tag from a venue
 */
export async function removeTagFromVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract venue ID and tag ID
  const venueId = formData.get("venueId")?.toString();
  const tagId = formData.get("tagId")?.toString();
  
  if (!venueId || !tagId) {
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "Venue ID and Tag ID are required");
  }
  
  try {
    // Delete venue_tag
    const { error } = await supabase
      .from('venue_tags')
      .delete()
      .eq('venue_id', venueId)
      .eq('tag_id', tagId);
    
    if (error) {
      console.error("Error removing tag from venue:", error);
      return encodedRedirect("error", `/dashboard/venues/${venueId}`, error.message);
    }
    
    revalidatePath(`/dashboard/venues/${venueId}`);
    return encodedRedirect("success", `/dashboard/venues/${venueId}`, "Tag removed from venue successfully");
  } catch (error) {
    console.error("Error removing tag from venue:", error);
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "An unexpected error occurred");
  }
}

/**
 * Pin a venue for a user
 */
export async function pinVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return encodedRedirect("error", "/dashboard", "You must be part of an organization");
  }
  
  // Extract venue ID
  const venueId = formData.get("venueId")?.toString();
  if (!venueId) {
    return encodedRedirect("error", "/dashboard/venues", "Venue ID is required");
  }
  
  try {
    // Insert user_pin
    const { error } = await supabase
      .from('user_pins')
      .insert([
        {
          user_id: user.id,
          venue_id: venueId,
          organization_id: profile.org_id
        }
      ]);
    
    if (error) {
      console.error("Error pinning venue:", error);
      return encodedRedirect("error", `/dashboard/venues/${venueId}`, error.message);
    }
    
    revalidatePath('/dashboard/venues');
    revalidatePath(`/dashboard/venues/${venueId}`);
    return encodedRedirect("success", `/dashboard/venues/${venueId}`, "Venue pinned successfully");
  } catch (error) {
    console.error("Error pinning venue:", error);
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "An unexpected error occurred");
  }
}

/**
 * Unpin a venue for a user
 */
export async function unpinVenue(formData: FormData) {
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return encodedRedirect("error", "/sign-in", "You must be logged in");
  }
  
  // Extract venue ID
  const venueId = formData.get("venueId")?.toString();
  if (!venueId) {
    return encodedRedirect("error", "/dashboard/venues", "Venue ID is required");
  }
  
  try {
    // Delete user_pin
    const { error } = await supabase
      .from('user_pins')
      .delete()
      .eq('user_id', user.id)
      .eq('venue_id', venueId);
    
    if (error) {
      console.error("Error unpinning venue:", error);
      return encodedRedirect("error", `/dashboard/venues/${venueId}`, error.message);
    }
    
    revalidatePath('/dashboard/venues');
    revalidatePath(`/dashboard/venues/${venueId}`);
    return encodedRedirect("success", `/dashboard/venues/${venueId}`, "Venue unpinned successfully");
  } catch (error) {
    console.error("Error unpinning venue:", error);
    return encodedRedirect("error", `/dashboard/venues/${venueId}`, "An unexpected error occurred");
  }
}

/**
 * Get pinned venues for the current user
 */
export async function getPinnedVenues() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in" };
  }
  
  // Get user profile to get organization_id
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.org_id) {
    return { error: "You must be part of an organization" };
  }
  
  // First, get all pinned venue IDs for the current user
  const { data: userPins, error: pinsError } = await supabase
    .from('user_pins')
    .select('venue_id')
    .eq('user_id', user.id)
    .eq('organization_id', profile.org_id);
  
  if (pinsError) {
    console.error("Error fetching user pins:", pinsError);
    return { error: "Failed to fetch user pins" };
  }
  
  // If no pins found, return empty array
  if (!userPins || userPins.length === 0) {
    return { data: [] };
  }
  
  // Extract venue IDs from pins
  const pinnedVenueIds = userPins.map(pin => pin.venue_id);
  
  // Get pinned venues
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      location:locations (
        id, address_line1, address_line2, city, state_province, postal_code, country, latitude, longitude
      ),
      tags:venue_tags (
        tag:tag_id (
          id, name
        )
      )
    `)
    .in('id', pinnedVenueIds);
  
  if (error) {
    console.error("Error fetching pinned venues:", error);
    return { error: "Failed to fetch pinned venues" };
  }
  
  // Add pinned status to all venues
  const venuesWithPinStatus = data.map(venue => ({
    ...venue,
    is_pinned: true
  }));
  
  return { data: venuesWithPinStatus as VenueWithLocation[] };
}