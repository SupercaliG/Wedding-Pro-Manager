import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getOrganizationAnnouncements,
  trackAnnouncementEngagement,
  hasUserSeenAnnouncement,
  getRecentEngagements
} from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('Announcement Actions', () => {
  // Mock Supabase client and responses
  const mockSupabase = {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn()
  }

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks()
    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createAnnouncement', () => {
    it('should create an announcement with minimal required fields', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'announcement-123',
          org_id: 'org-123',
          user_id: 'user-123',
          title: 'Test Announcement',
          content: 'This is a test',
          is_active: true,
          pinned_until: null
        },
        error: null
      })

      // Call the function
      const result = await createAnnouncement({
        orgId: 'org-123',
        title: 'Test Announcement',
        content: 'This is a test'
      })

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        org_id: 'org-123',
        user_id: 'user-123',
        title: 'Test Announcement',
        content: 'This is a test',
        is_active: true,
        pinned_until: null
      })
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
      expect(result).toEqual({
        id: 'announcement-123',
        org_id: 'org-123',
        user_id: 'user-123',
        title: 'Test Announcement',
        content: 'This is a test',
        is_active: true,
        pinned_until: null
      })
    })

    it('should create an announcement with all fields including pinned', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'announcement-123',
          org_id: 'org-123',
          user_id: 'user-123',
          title: 'Test Announcement',
          content: 'This is a test',
          is_active: true,
          pinned_until: '2025-06-01T00:00:00.000Z'
        },
        error: null
      })

      const pinnedDate = new Date('2025-06-01')

      // Call the function
      const result = await createAnnouncement({
        orgId: 'org-123',
        title: 'Test Announcement',
        content: 'This is a test',
        isActive: true,
        pinnedUntil: pinnedDate,
        metadata: { important: true }
      })

      // Assertions
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        org_id: 'org-123',
        user_id: 'user-123',
        title: 'Test Announcement',
        content: 'This is a test',
        is_active: true,
        pinned_until: pinnedDate.toISOString()
      })
      expect(result.pinned_until).toBe('2025-06-01T00:00:00.000Z')
    })

    it('should throw an error when unauthorized', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      // Call the function and expect it to throw
      await expect(createAnnouncement({
        orgId: 'org-123',
        title: 'Test Announcement',
        content: 'This is a test'
      })).rejects.toThrow('Unauthorized')
    })

    it('should throw an error when validation fails', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Validation error' }
      })

      // Call the function and expect it to throw
      await expect(createAnnouncement({
        orgId: 'org-123',
        title: 'Test Announcement',
        content: 'This is a test'
      })).rejects.toThrow('Failed to create announcement: Validation error')
    })
  })

  describe('updateAnnouncement', () => {
    it('should update an announcement with all fields', async () => {
      // Setup mocks
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'announcement-123',
          title: 'Updated Title',
          content: 'Updated content',
          is_active: false,
          pinned_until: '2025-06-01T00:00:00.000Z'
        },
        error: null
      })

      const pinnedDate = new Date('2025-06-01')

      // Call the function
      const result = await updateAnnouncement({
        id: 'announcement-123',
        title: 'Updated Title',
        content: 'Updated content',
        isActive: false,
        pinnedUntil: pinnedDate
      })

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        title: 'Updated Title',
        content: 'Updated content',
        is_active: false,
        pinned_until: pinnedDate.toISOString()
      })
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'announcement-123')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
      expect(result).toEqual({
        id: 'announcement-123',
        title: 'Updated Title',
        content: 'Updated content',
        is_active: false,
        pinned_until: '2025-06-01T00:00:00.000Z'
      })
    })

    it('should update an announcement with partial fields', async () => {
      // Setup mocks
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'announcement-123',
          title: 'Original Title',
          content: 'Updated content',
          is_active: true,
          pinned_until: null
        },
        error: null
      })

      // Call the function with only content update
      const result = await updateAnnouncement({
        id: 'announcement-123',
        content: 'Updated content'
      })

      // Assertions
      expect(mockSupabase.update).toHaveBeenCalledWith({
        content: 'Updated content'
      })
      expect(result.content).toBe('Updated content')
    })

    it('should throw an error when update fails', async () => {
      // Setup mocks
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      })

      // Call the function and expect it to throw
      await expect(updateAnnouncement({
        id: 'announcement-123',
        title: 'Updated Title'
      })).rejects.toThrow('Failed to update announcement: Update failed')
    })
  })

  describe('deleteAnnouncement', () => {
    it('should delete an announcement successfully', async () => {
      // Setup mocks
      mockSupabase.delete.mockImplementation(() => mockSupabase)
      mockSupabase.eq.mockResolvedValue({
        error: null
      })

      // Call the function
      const result = await deleteAnnouncement('announcement-123')

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'announcement-123')
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
      expect(result).toEqual({ success: true })
    })

    it('should throw an error when deletion fails', async () => {
      // Setup mocks
      mockSupabase.delete.mockImplementation(() => mockSupabase)
      mockSupabase.eq.mockResolvedValue({
        error: { message: 'Deletion failed' }
      })

      // Call the function and expect it to throw
      await expect(deleteAnnouncement('announcement-123')).rejects.toThrow('Failed to delete announcement: Deletion failed')
    })
  })

  describe('getOrganizationAnnouncements', () => {
    it('should fetch all announcements', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.from.mockImplementation(() => mockSupabase)
      mockSupabase.select.mockImplementation(() => mockSupabase)
      mockSupabase.eq.mockImplementation(() => mockSupabase)
      mockSupabase.order.mockImplementation(() => mockSupabase)
      mockSupabase.order.mockResolvedValue({
        data: [
          { id: 'announcement-1', title: 'First Announcement' },
          { id: 'announcement-2', title: 'Second Announcement' }
        ],
        error: null
      })

      // Mock profile fetch
      const mockProfileSelect = vi.fn().mockReturnThis()
      const mockProfileEq = vi.fn().mockReturnThis()
      const mockProfileSingle = vi.fn().mockResolvedValue({
        data: { org_id: 'org-123' },
        error: null
      })

      mockSupabase.from.mockImplementationOnce(() => ({
        select: mockProfileSelect,
        eq: mockProfileEq,
        single: mockProfileSingle
      }))

      // Call the function
      const result = await getOrganizationAnnouncements({ onlyActive: false })

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockProfileSelect).toHaveBeenCalledWith('org_id')
      expect(mockProfileEq).toHaveBeenCalledWith('id', 'user-123')
      expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'org-123')
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual([
        { id: 'announcement-1', title: 'First Announcement' },
        { id: 'announcement-2', title: 'Second Announcement' }
      ])
    })

    it('should fetch only active announcements', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.from.mockImplementation(() => mockSupabase)
      mockSupabase.select.mockImplementation(() => mockSupabase)
      mockSupabase.eq.mockImplementation(() => mockSupabase)
      mockSupabase.order.mockImplementation(() => mockSupabase)
      mockSupabase.order.mockResolvedValue({
        data: [
          { id: 'announcement-1', title: 'Active Announcement', is_active: true }
        ],
        error: null
      })

      // Mock profile fetch
      const mockProfileSelect = vi.fn().mockReturnThis()
      const mockProfileEq = vi.fn().mockReturnThis()
      const mockProfileSingle = vi.fn().mockResolvedValue({
        data: { org_id: 'org-123' },
        error: null
      })

      mockSupabase.from.mockImplementationOnce(() => ({
        select: mockProfileSelect,
        eq: mockProfileEq,
        single: mockProfileSingle
      }))

      // Call the function
      const result = await getOrganizationAnnouncements({ onlyActive: true })

      // Assertions
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual([
        { id: 'announcement-1', title: 'Active Announcement', is_active: true }
      ])
    })

    it('should throw an error when unauthorized', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      // Call the function and expect it to throw
      await expect(getOrganizationAnnouncements()).rejects.toThrow('Unauthorized')
    })

    it('should throw an error when user has no organization', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock profile fetch with no org_id
      const mockProfileSelect = vi.fn().mockReturnThis()
      const mockProfileEq = vi.fn().mockReturnThis()
      const mockProfileSingle = vi.fn().mockResolvedValue({
        data: { org_id: null },
        error: null
      })

      mockSupabase.from.mockImplementationOnce(() => ({
        select: mockProfileSelect,
        eq: mockProfileEq,
        single: mockProfileSingle
      }))

      // Call the function and expect it to throw
      await expect(getOrganizationAnnouncements()).rejects.toThrow('User has no organization')
    })
  })

  describe('trackAnnouncementEngagement', () => {
    it('should track view engagement', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'engagement-123',
          announcement_id: 'announcement-123',
          user_id: 'user-123',
          engagement_type: 'view',
          metadata: { client_timestamp: expect.any(String) }
        },
        error: null
      })

      // Mock getRecentEngagements to return empty array (no duplicates)
      vi.mock('./announcement-actions', async () => {
        const actual = await vi.importActual('./announcement-actions')
        return {
          ...actual,
          getRecentEngagements: vi.fn().mockResolvedValue([])
        }
      })

      // Call the function
      const result = await trackAnnouncementEngagement({
        announcementId: 'announcement-123',
        engagementType: 'view'
      })

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('announcement_engagements')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'view',
        metadata: expect.objectContaining({
          client_timestamp: expect.any(String),
          client_info: expect.any(Object)
        })
      })
      expect(result).toEqual({
        id: 'engagement-123',
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'view',
        metadata: expect.any(Object)
      })
    })

    it('should track dismiss engagement', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'engagement-123',
          announcement_id: 'announcement-123',
          user_id: 'user-123',
          engagement_type: 'dismiss',
          metadata: { client_timestamp: expect.any(String) }
        },
        error: null
      })

      // Mock getRecentEngagements to return empty array (no duplicates)
      vi.mock('./announcement-actions', async () => {
        const actual = await vi.importActual('./announcement-actions')
        return {
          ...actual,
          getRecentEngagements: vi.fn().mockResolvedValue([])
        }
      })

      // Call the function
      const result = await trackAnnouncementEngagement({
        announcementId: 'announcement-123',
        engagementType: 'dismiss',
        metadata: { dismiss_source: 'close_button' }
      })

      // Assertions
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'dismiss',
        metadata: expect.objectContaining({
          dismiss_source: 'close_button',
          client_timestamp: expect.any(String)
        })
      })
      expect(result.engagement_type).toBe('dismiss')
    })

    it('should handle deduplication for view engagements', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock recent engagements to simulate a duplicate
      const recentEngagement = {
        id: 'engagement-123',
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'view',
        created_at: new Date().toISOString(),
        metadata: { client_timestamp: new Date().toISOString() }
      }

      // Mock getRecentEngagements to return a recent engagement
      const getRecentEngagementsMock = vi.fn().mockResolvedValue([recentEngagement])
      vi.mock('./announcement-actions', async () => {
        const actual = await vi.importActual('./announcement-actions')
        return {
          ...actual,
          getRecentEngagements: getRecentEngagementsMock
        }
      })

      // Call the function
      const result = await trackAnnouncementEngagement({
        announcementId: 'announcement-123',
        engagementType: 'view',
        deduplicate: true
      })

      // Assertions
      expect(getRecentEngagementsMock).toHaveBeenCalledWith({
        announcementId: 'announcement-123',
        engagementType: 'view',
        timeWindowSeconds: expect.any(Number)
      })
      // Should return the existing engagement without creating a new one
      expect(result).toEqual(recentEngagement)
      // Insert should not be called
      expect(mockSupabase.insert).not.toHaveBeenCalled()
    })
  })

  describe('hasUserSeenAnnouncement', () => {
    it('should return true when user has seen the announcement', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.limit.mockResolvedValue({
        data: [{ id: 'engagement-123' }],
        error: null
      })

      // Call the function
      const result = await hasUserSeenAnnouncement('announcement-123')

      // Assertions
      expect(createClient).toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('announcement_engagements')
      expect(mockSupabase.select).toHaveBeenCalledWith('id')
      expect(mockSupabase.eq).toHaveBeenCalledWith('announcement_id', 'announcement-123')
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockSupabase.eq).toHaveBeenCalledWith('engagement_type', 'view')
      expect(mockSupabase.limit).toHaveBeenCalledWith(1)
      expect(result).toBe(true)
    })

    it('should return false when user has not seen the announcement', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      mockSupabase.limit.mockResolvedValue({
        data: [],
        error: null
      })

      // Call the function
      const result = await hasUserSeenAnnouncement('announcement-123')

      // Assertions
      expect(result).toBe(false)
    })

    it('should throw an error when unauthorized', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      // Call the function and expect it to throw
      await expect(hasUserSeenAnnouncement('announcement-123')).rejects.toThrow('Unauthorized')
    })
  })
})