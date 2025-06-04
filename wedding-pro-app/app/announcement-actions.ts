'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Create a new announcement for the user's active organization
 */
export async function createAnnouncement({
  title,
  content,
  isActive = true,
  pinnedUntil = null,
  metadata = {}
}: {
  title: string
  content: string
  isActive?: boolean
  pinnedUntil?: Date | null
  metadata?: Record<string, any>
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: User not found')
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    throw new Error('Unauthorized: No active organization selected');
  }

  // Get the UUID of the active organization
  const { data: activeOrgData, error: activeOrgError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText) // TEXT active_org_id from JWT
    .single();

  if (activeOrgError || !activeOrgData) {
    console.error("Error fetching active organization UUID:", activeOrgError);
    throw new Error('Failed to identify active organization');
  }
  const activeOrgUuid = activeOrgData.id;

  const { data, error } = await supabase
    .from('org_announcements')
    .insert({
      org_id: activeOrgUuid, // Use the UUID of the active org
      user_id: user.id,
      title,
      content,
      is_active: isActive,
      pinned_until: pinnedUntil ? pinnedUntil.toISOString() : null,
      // metadata is not a direct column in the provided snippet for org_announcements,
      // if it exists, it should be added here. Assuming it's not for now.
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`)
  }

  revalidatePath('/dashboard') // Or a more specific path where announcements are shown
  return data
}

/**
 * Update an existing announcement
 * Note: This function should also verify that the announcement belongs to the user's active org.
 */
export async function updateAnnouncement({
  id, // announcement UUID
  title,
  content,
  isActive,
  pinnedUntil
}: {
  id: string
  title?: string
  content?: string
  isActive?: boolean
  pinnedUntil?: Date | null
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Unauthorized: User not found');
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    throw new Error('Unauthorized: No active organization selected');
  }

  // Get the UUID of the active organization
  const { data: activeOrgData, error: activeOrgError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText)
    .single();

  if (activeOrgError || !activeOrgData) {
    throw new Error('Failed to identify active organization for update');
  }
  const activeOrgUuid = activeOrgData.id;

  // Verify the announcement belongs to the active organization before updating
  const { data: announcementToUpdate, error: fetchError } = await supabase
    .from('org_announcements')
    .select('org_id')
    .eq('id', id)
    .single();

  if (fetchError || !announcementToUpdate) {
    throw new Error(`Announcement not found or error fetching: ${fetchError?.message || 'Not found'}`);
  }

  if (announcementToUpdate.org_id !== activeOrgUuid) {
    throw new Error('Forbidden: Announcement does not belong to your active organization.');
  }

  const updates: any = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  if (isActive !== undefined) updates.is_active = isActive
  if (pinnedUntil !== undefined) updates.pinned_until = pinnedUntil ? pinnedUntil.toISOString() : null

  const { data, error } = await supabase
    .from('org_announcements')
    .update(updates)
    .eq('id', id)
    // .eq('org_id', activeOrgUuid) // Double check, already verified above
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update announcement: ${error.message}`)
  }

  revalidatePath('/dashboard')
  return data
}

/**
 * Delete an announcement
 * Note: This function should also verify that the announcement belongs to the user's active org.
 */
export async function deleteAnnouncement(id: string) { // announcement UUID
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Unauthorized: User not found');
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    throw new Error('Unauthorized: No active organization selected');
  }
  
  const { data: activeOrgData, error: activeOrgError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText)
    .single();

  if (activeOrgError || !activeOrgData) {
    throw new Error('Failed to identify active organization for delete');
  }
  const activeOrgUuid = activeOrgData.id;

  // Verify the announcement belongs to the active organization before deleting
  const { data: announcementToDelete, error: fetchError } = await supabase
    .from('org_announcements')
    .select('org_id')
    .eq('id', id)
    .single();

  if (fetchError || !announcementToDelete) {
    throw new Error(`Announcement not found or error fetching: ${fetchError?.message || 'Not found'}`);
  }

  if (announcementToDelete.org_id !== activeOrgUuid) {
    throw new Error('Forbidden: Announcement does not belong to your active organization.');
  }

  const { error } = await supabase
    .from('org_announcements')
    .delete()
    .eq('id', id)
    // .eq('org_id', activeOrgUuid) // Double check, already verified above

  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`)
  }

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Get announcements for the current user's active organization
 */
export async function getOrganizationAnnouncements({
  onlyActive = true,
  onlyPinned = false
}: {
  onlyActive?: boolean
  onlyPinned?: boolean
} = {}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    // For public-facing scenarios, might return empty array instead of throwing
    console.warn("getOrganizationAnnouncements: User not authenticated. Returning empty array.");
    return [];
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;

  if (!activeOrgIdText) {
    console.warn("getOrganizationAnnouncements: No active organization ID found in JWT. Returning empty array.");
    return [];
  }

  // Get the UUID of the active organization
  const { data: activeOrgData, error: activeOrgFetchError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText) // TEXT active_org_id from JWT
    .single();

  if (activeOrgFetchError || !activeOrgData) {
    console.warn(
      `getOrganizationAnnouncements: Could not find org details for active_org_id ${activeOrgIdText}. Returning empty. Error: ${activeOrgFetchError?.message}`
    );
    return [];
  }
  const activeOrgUuid = activeOrgData.id;

  let query = supabase
    .from('org_announcements')
    .select('*')
    .eq('org_id', activeOrgUuid) // Use the UUID of the active org
    .order('created_at', { ascending: false })

  if (onlyActive) {
    query = query.eq('is_active', true)
  }

  if (onlyPinned) {
    const now = new Date().toISOString()
    query = query.not('pinned_until', 'is', null).gte('pinned_until', now)
  }

  const { data, error } = await query

  if (error) {
    // Log error but return empty array for resilience in UI
    console.error(`Failed to fetch announcements for org UUID ${activeOrgUuid}: ${error.message}`);
    return [];
  }

  return data || []
}

/**
 * Get recent engagements for a user and announcement
 * Used for deduplication and analytics
 * This function is user-specific and announcement-specific, not directly org-scoped by active_org_id here.
 * Org scoping is implicit via announcementId if announcements are org-specific.
 */
export async function getRecentEngagements({
  announcementId,
  engagementType,
  timeWindowSeconds = 60
}: {
  announcementId: string
  engagementType: 'view' | 'dismiss' | 'click'
  timeWindowSeconds?: number
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }

  const timeWindow = new Date()
  timeWindow.setSeconds(timeWindow.getSeconds() - timeWindowSeconds)

  const { data, error } = await supabase
    .from('announcement_engagements')
    .select('*')
    .eq('announcement_id', announcementId)
    .eq('user_id', user.id)
    .eq('engagement_type', engagementType)
    .gte('created_at', timeWindow.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get recent engagements: ${error.message}`)
  }

  return data || []
}

/**
 * Track user engagement with an announcement
 * Includes deduplication logic to prevent multiple identical engagements in short time periods
 * This function is user-specific and announcement-specific.
 */
export async function trackAnnouncementEngagement({
  announcementId,
  engagementType,
  metadata = {},
  deduplicate = true,
  deduplicationWindow = 60 // seconds
}: {
  announcementId: string
  engagementType: 'view' | 'dismiss' | 'click'
  metadata?: Record<string, any>
  deduplicate?: boolean
  deduplicationWindow?: number
}) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }

  const enrichedMetadata = {
    ...metadata,
    client_timestamp: new Date().toISOString(),
    client_info: {
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : null
    }
  }

  if (deduplicate) {
    try {
      const recentEngagements = await getRecentEngagements({
        announcementId,
        engagementType,
        timeWindowSeconds: deduplicationWindow
      })

      if (recentEngagements.length > 0) {
        if (engagementType === 'click' &&
            metadata.url &&
            recentEngagements.some(e => e.metadata?.url === metadata.url)) {
          return recentEngagements[0]
        }
        else if (engagementType !== 'click') {
          return recentEngagements[0]
        }
      }
    } catch (err) {
      console.error('Deduplication check failed:', err)
    }
  }

  try {
    const { data, error } = await supabase
      .from('announcement_engagements')
      .insert({
        announcement_id: announcementId,
        user_id: user.id,
        engagement_type: engagementType,
        metadata: enrichedMetadata
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to track engagement: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error(`Error tracking ${engagementType} engagement:`, error)
    if (error instanceof Error) {
      throw new Error(`Failed to track ${engagementType} engagement: ${error.message}`)
    } else {
      throw new Error(`Failed to track ${engagementType} engagement: Unknown error`)
    }
  }
}

/**
 * Get analytics for announcements in the user's active organization
 */
export async function getAnnouncementAnalytics() { // Removed orgId parameter
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Unauthorized: User not found');
  }

  const activeOrgIdText = user.app_metadata?.active_org_id as string | undefined;
  if (!activeOrgIdText) {
    // Or return empty array if preferred for analytics display
    throw new Error('Unauthorized: No active organization selected for analytics');
  }

  // Get the UUID of the active organization
  const { data: activeOrgData, error: activeOrgFetchError } = await supabase
    .from('orgs')
    .select('id') // UUID
    .eq('organization_id', activeOrgIdText)
    .single();

  if (activeOrgFetchError || !activeOrgData) {
    console.error(`Error fetching org UUID for analytics (activeOrgIdText: ${activeOrgIdText}):`, activeOrgFetchError);
    throw new Error('Failed to identify active organization for analytics');
  }
  const activeOrgUuid = activeOrgData.id;


  const { data, error } = await supabase
    .from('announcement_analytics') // Assuming this view/table exists and has an org_id (UUID)
    .select('*')
    .eq('org_id', activeOrgUuid) // Filter by active org's UUID
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch announcement analytics: ${error.message}`)
  }

  return data || []
}

/**
 * Check if a user has seen an announcement
 * This function is user-specific and announcement-specific.
 */
export async function hasUserSeenAnnouncement(announcementId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('announcement_engagements')
    .select('id')
    .eq('announcement_id', announcementId)
    .eq('user_id', user.id)
    .eq('engagement_type', 'view')
    .limit(1)

  if (error) {
    throw new Error(`Failed to check if user has seen announcement: ${error.message}`)
  }

  return data && data.length > 0
}