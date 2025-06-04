import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteAnnouncement } from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('deleteAnnouncement', () => {
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

    // Default user mock
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
    const mockAnnouncementEq = vi.fn().mockReturnThis(); // For permission check eq and delete eq
    const mockAnnouncementSelect = vi.fn().mockReturnValue({ eq: mockAnnouncementEq, single: mockAnnouncementSingle });
    
    const mockDelete = vi.fn().mockReturnValue({ eq: mockAnnouncementEq }); // Delete itself returns 'this' then eq

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { 
          select: mockAnnouncementSelect, 
          delete: mockDelete, // Use the specific delete mock
          eq: mockSupabase.eq, // from general mock, used by select and delete
          single: mockSupabase.single // from general mock for select().single()
        };
      }
      return mockSupabase;
    });
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should delete an announcement successfully', async () => {
    // Specific mock for the delete operation's .eq().then()
    mockSupabase.eq.mockResolvedValueOnce({ // This is for the .delete().eq() call
      error: null 
    });

    // Call the function
    const result = await deleteAnnouncement('announcement-123')

    // Assertions
    expect(createClient).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements') // For permission check
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements') // For delete
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'announcement-123') // For delete
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(result).toEqual({ success: true })
  })

  it('should throw an error when deletion fails (Supabase error)', async () => {
     // Specific mock for the delete operation's .eq().then() to return an error
    mockSupabase.eq.mockResolvedValueOnce({ // This is for the .delete().eq() call
      error: { message: 'Deletion failed' } 
    });
    
    // Call the function and expect it to throw
    await expect(deleteAnnouncement('announcement-123')).rejects.toThrow('Failed to delete announcement: Deletion failed')
  })

  it('should throw "Unauthorized: User not found" if no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(deleteAnnouncement('announcement-123'))
      .rejects.toThrow('Unauthorized: User not found');
  });

  it('should throw "Unauthorized: No active organization selected" if no active_org_id', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', app_metadata: {} } }, // No active_org_id
      error: null,
    });
    await expect(deleteAnnouncement('announcement-123'))
      .rejects.toThrow('Unauthorized: No active organization selected');
  });

  it('should throw "Failed to identify active organization for delete" if org fetch fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ // User is fine
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

    await expect(deleteAnnouncement('announcement-123'))
      .rejects.toThrow('Failed to identify active organization for delete');
  });

  it('should throw "Announcement not found or error fetching" if announcement to delete is not found', async () => {
    // User and Org are fine (relying on beforeEach setup for these)
    // Announcement fetch fails for permission check
    const mockAnnouncementSingleFail = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const mockAnnouncementEqFail = vi.fn().mockReturnThis();
    const mockAnnouncementSelectFail = vi.fn().mockReturnValue({ eq: mockAnnouncementEqFail, single: mockAnnouncementSingleFail });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') { // Keep orgs working
        const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
        const mockOrgEq = vi.fn().mockReturnThis();
        const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { select: mockAnnouncementSelectFail, delete: mockSupabase.delete, eq: mockSupabase.eq, single: mockSupabase.single };
      }
      return mockSupabase;
    });
    
    await expect(deleteAnnouncement('non-existent-announcement'))
      .rejects.toThrow('Announcement not found or error fetching: Not found');
  });

  it('should throw "Forbidden: Announcement does not belong to your active organization" if org_ids mismatch', async () => {
    // User and Org are fine (relying on beforeEach setup for these)
    // Announcement fetch returns a different org_id for permission check
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
        return { select: mockAnnouncementSelectMismatch, delete: mockSupabase.delete, eq: mockSupabase.eq, single: mockSupabase.single };
      }
      return mockSupabase;
    });

    await expect(deleteAnnouncement('announcement-other-org'))
      .rejects.toThrow('Forbidden: Announcement does not belong to your active organization.');
  });
})