'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Create a new announcement for an organization
 */
export async function createAnnouncement({
  orgId,
  title,
  content,
  isActive = true,
  pinnedUntil = null,
  metadata = {}
}: {
  orgId: string
  title: string
  content: string
  isActive?: boolean
  pinnedUntil?: Date | null
  metadata?: Record<string, any>
}) {
  const supabase = await createClient()

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('org_announcements')
    .insert({
      org_id: orgId,
      user_id: user.user.id,
      title,
      content,
      is_active: isActive,
      pinned_until: pinnedUntil ? pinnedUntil.toISOString() : null
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`)
  }

  revalidatePath('/dashboard')
  return data
}

/**
 * Update an existing announcement
 */
export async function updateAnnouncement({
  id,
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

  const updates: any = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) updates.content = content
  if (isActive !== undefined) updates.is_active = isActive
  if (pinnedUntil !== undefined) updates.pinned_until = pinnedUntil ? pinnedUntil.toISOString() : null

  const { data, error } = await supabase
    .from('org_announcements')
    .update(updates)
    .eq('id', id)
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
 */
export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('org_announcements')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete announcement: ${error.message}`)
  }

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Get announcements for the current user's organization
 */
export async function getOrganizationAnnouncements({
  onlyActive = true,
  onlyPinned = false
}: {
  onlyActive?: boolean
  onlyPinned?: boolean
} = {}) {
  const supabase = await createClient()

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    throw new Error('Unauthorized')
  }

  // Get the user's organization ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.user.id)
    .single()

  if (profileError || !profile?.org_id) {
    throw new Error('User has no organization')
  }

  let query = supabase
    .from('org_announcements')
    .select('*')
    .eq('org_id', profile.org_id)
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
    throw new Error(`Failed to fetch announcements: ${error.message}`)
  }

  return data || []
}

/**
 * Get recent engagements for a user and announcement
 * Used for deduplication and analytics
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

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    throw new Error('Unauthorized')
  }

  // Calculate the time window
  const timeWindow = new Date()
  timeWindow.setSeconds(timeWindow.getSeconds() - timeWindowSeconds)

  const { data, error } = await supabase
    .from('announcement_engagements')
    .select('*')
    .eq('announcement_id', announcementId)
    .eq('user_id', user.user.id)
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

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    throw new Error('Unauthorized')
  }

  // Add client timestamp to metadata
  const enrichedMetadata = {
    ...metadata,
    client_timestamp: new Date().toISOString(),
    client_info: {
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : null
    }
  }

  // Check for recent duplicate engagements if deduplication is enabled
  if (deduplicate) {
    try {
      const recentEngagements = await getRecentEngagements({
        announcementId,
        engagementType,
        timeWindowSeconds: deduplicationWindow
      })

      // If there's a recent engagement of the same type, don't create a duplicate
      if (recentEngagements.length > 0) {
        // For 'click' events, only deduplicate if the metadata URL matches
        if (engagementType === 'click' &&
            metadata.url &&
            recentEngagements.some(e => e.metadata?.url === metadata.url)) {
          return recentEngagements[0]
        }
        // For view and dismiss events, always deduplicate
        else if (engagementType !== 'click') {
          return recentEngagements[0]
        }
      }
    } catch (err) {
      // If deduplication check fails, continue with tracking anyway
      console.error('Deduplication check failed:', err)
    }
  }

  // Insert the engagement record
  try {
    const { data, error } = await supabase
      .from('announcement_engagements')
      .insert({
        announcement_id: announcementId,
        user_id: user.user.id,
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
    // Enhanced error handling
    console.error(`Error tracking ${engagementType} engagement:`, error)
    
    // Rethrow with more context
    if (error instanceof Error) {
      throw new Error(`Failed to track ${engagementType} engagement: ${error.message}`)
    } else {
      throw new Error(`Failed to track ${engagementType} engagement: Unknown error`)
    }
  }
}

/**
 * Get analytics for announcements in an organization
 */
export async function getAnnouncementAnalytics(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('announcement_analytics')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch announcement analytics: ${error.message}`)
  }

  return data || []
}

/**
 * Check if a user has seen an announcement
 */
export async function hasUserSeenAnnouncement(announcementId: string) {
  const supabase = await createClient()

  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('announcement_engagements')
    .select('id')
    .eq('announcement_id', announcementId)
    .eq('user_id', user.user.id)
    .eq('engagement_type', 'view')
    .limit(1)

  if (error) {
    throw new Error(`Failed to check if user has seen announcement: ${error.message}`)
  }

  return data && data.length > 0
}