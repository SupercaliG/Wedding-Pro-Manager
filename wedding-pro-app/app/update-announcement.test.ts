import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateAnnouncement } from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('updateAnnouncement', () => {
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

    // Default user mock for most update tests
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })

    // Default org UUID fetch mock
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
    
    // Default announcement fetch mock (for permission check)
    const mockAnnouncementSingle = vi.fn().mockResolvedValue({ data: { org_id: 'org-uuid-123' }, error: null });
    const mockAnnouncementEq = vi.fn().mockReturnThis();
    const mockAnnouncementSelect = vi.fn().mockReturnValue({ eq: mockAnnouncementEq, single: mockAnnouncementSingle });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        // This will handle both the permission check select and the update select
        return { 
          select: mockAnnouncementSelect, 
          update: mockSupabase.update, // from general mock
          eq: mockSupabase.eq, // from general mock
          single: mockSupabase.single // from general mock for update().select().single()
        };
      }
      return mockSupabase;
    });
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should update an announcement with all fields', async () => {
    // Setup mocks for the update itself
    mockSupabase.single.mockResolvedValueOnce({ // For the update().select().single()
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
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements') // For permission check
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements') // For update
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
    // Setup mocks for the update itself
    mockSupabase.single.mockResolvedValueOnce({ // For the update().select().single()
      data: {
        id: 'announcement-123',
        title: 'Original Title', // Assuming title is not updated
        content: 'Updated content',
        is_active: true, // Assuming isActive is not updated
        pinned_until: null // Assuming pinnedUntil is not updated
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

  it('should throw an error when update fails (Supabase error)', async () => {
    // Setup mocks for the update itself to fail
    mockSupabase.single.mockResolvedValueOnce({ // For the update().select().single()
      data: null,
      error: { message: 'Update failed' }
    })

    // Call the function and expect it to throw
    await expect(updateAnnouncement({
      id: 'announcement-123',
      title: 'Updated Title'
    })).rejects.toThrow('Failed to update announcement: Update failed')
  })

  it('should throw "Unauthorized: User not found" if no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(updateAnnouncement({ id: 'announcement-123', title: 'Test' }))
      .rejects.toThrow('Unauthorized: User not found');
  });

  it('should throw "Unauthorized: No active organization selected" if no active_org_id', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', app_metadata: {} } }, // No active_org_id
      error: null,
    });
    await expect(updateAnnouncement({ id: 'announcement-123', title: 'Test' }))
      .rejects.toThrow('Unauthorized: No active organization selected');
  });

  it('should throw "Failed to identify active organization for update" if org fetch fails', async () => {
    // User is fine
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    });
    // Org fetch fails
    const mockOrgSingleFail = vi.fn().mockResolvedValue({ data: null, error: { message: 'Org fetch failed' } });
    const mockOrgEqFail = vi.fn().mockReturnThis();
    const mockOrgSelectFail = vi.fn().mockReturnValue({ eq: mockOrgEqFail, single: mockOrgSingleFail });
    
    mockSupabase.from.mockImplementationOnce((tableName: string) => { // Only for the 'orgs' call
      if (tableName === 'orgs') {
        return { select: mockOrgSelectFail };
      }
      return mockSupabase;
    });

    await expect(updateAnnouncement({ id: 'announcement-123', title: 'Test' }))
      .rejects.toThrow('Failed to identify active organization for update');
  });

  it('should throw "Announcement not found or error fetching" if announcement to update is not found', async () => {
    // User and Org are fine (relying on beforeEach setup for these)
    // Announcement fetch fails
    const mockAnnouncementSingleFail = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const mockAnnouncementEqFail = vi.fn().mockReturnThis();
    const mockAnnouncementSelectFail = vi.fn().mockReturnValue({ eq: mockAnnouncementEqFail, single: mockAnnouncementSingleFail });

    // Override the .from for org_announcements for this specific test
     mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') { // Keep orgs working as per beforeEach
        const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
        const mockOrgEq = vi.fn().mockReturnThis();
        const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { select: mockAnnouncementSelectFail, eq: mockSupabase.eq, single: mockSupabase.single }; // Use the failing mock for select
      }
      return mockSupabase;
    });
    
    await expect(updateAnnouncement({ id: 'non-existent-announcement', title: 'Test' }))
      .rejects.toThrow('Announcement not found or error fetching: Not found');
  });

  it('should throw "Forbidden: Announcement does not belong to your active organization" if org_ids mismatch', async () => {
    // User and Org are fine (relying on beforeEach setup for these)
    // Announcement fetch returns a different org_id
    const mockAnnouncementSingleMismatch = vi.fn().mockResolvedValue({ data: { org_id: 'different-org-uuid' }, error: null });
    const mockAnnouncementEqMismatch = vi.fn().mockReturnThis();
    const mockAnnouncementSelectMismatch = vi.fn().mockReturnValue({ eq: mockAnnouncementEqMismatch, single: mockAnnouncementSingleMismatch });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') { // Keep orgs working
        const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
        const mockOrgEq = vi.fn().mockReturnThis();
        const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { select: mockAnnouncementSelectMismatch, eq: mockSupabase.eq, single: mockSupabase.single };
      }
      return mockSupabase;
    });

    await expect(updateAnnouncement({ id: 'announcement-other-org', title: 'Test' }))
      .rejects.toThrow('Forbidden: Announcement does not belong to your active organization.');
  });
})