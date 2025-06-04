import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnnouncement } from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('createAnnouncement', () => {
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

  it('should create an announcement with minimal required fields', async () => {
    // Setup mocks
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })
    // Mock for fetching org UUID
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      return mockSupabase; // for org_announcements
    });

    mockSupabase.single.mockResolvedValue({ // This is for the insert().select().single()
      data: {
        id: 'announcement-123',
        org_id: 'org-uuid-123', // Expecting UUID
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
      // orgId is not a direct param
      title: 'Test Announcement',
      content: 'This is a test'
    })

    // Assertions
    expect(createClient).toHaveBeenCalled()
    expect(mockSupabase.auth.getUser).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith('orgs')
    expect(mockOrgSelect).toHaveBeenCalledWith('id')
    expect(mockOrgEq).toHaveBeenCalledWith('organization_id', 'org-text-id-123')
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements')
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      org_id: 'org-uuid-123', // Expecting UUID
      user_id: 'user-123',
      title: 'Test Announcement',
      content: 'This is a test',
      is_active: true,
      pinned_until: null
    })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(result).toEqual({
      id: 'announcement-123',
      org_id: 'org-uuid-123', // Expecting UUID
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
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })
    // Mock for fetching org UUID
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      return mockSupabase; // for org_announcements
    });

    mockSupabase.single.mockResolvedValue({ // This is for the insert().select().single()
      data: {
        id: 'announcement-123',
        org_id: 'org-uuid-123', // Expecting UUID
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
      // orgId is not a direct param
      title: 'Test Announcement',
      content: 'This is a test',
      isActive: true,
      pinnedUntil: pinnedDate,
      metadata: { important: true }
    })

    // Assertions
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      org_id: 'org-uuid-123', // Expecting UUID
      user_id: 'user-123',
      title: 'Test Announcement',
      content: 'This is a test',
      is_active: true,
      pinned_until: pinnedDate.toISOString()
    })
    expect(result.pinned_until).toBe('2025-06-01T00:00:00.000Z')
  })

  it('should throw an error when unauthorized (no user)', async () => {
    // Setup mocks
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null }, // Simulating no user
      error: null // Can also be { message: 'Not authenticated' }
    })

    // Call the function and expect it to throw
    await expect(createAnnouncement({
      // orgId is not a direct param
      title: 'Test Announcement',
      content: 'This is a test'
    })).rejects.toThrow('Unauthorized: User not found')
  })
  
  it('should throw an error when user has no active_org_id', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { /* no active_org_id */ } } },
      error: null
    });

    await expect(createAnnouncement({
      title: 'Test Announcement',
      content: 'This is a test'
    })).rejects.toThrow('Unauthorized: No active organization selected');
  });

  it('should throw an error when fetching active org UUID fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    });
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Org fetch failed' } });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      return mockSupabase;
    });

    await expect(createAnnouncement({
      title: 'Test Announcement',
      content: 'This is a test'
    })).rejects.toThrow('Failed to identify active organization');
  });


  it('should throw an error when insert validation fails', async () => {
    // Setup mocks
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })
     // Mock for fetching org UUID
    const mockOrgSingleFetch = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEqFetch = vi.fn().mockReturnThis();
    const mockOrgSelectFetch = vi.fn().mockReturnValue({ eq: mockOrgEqFetch, single: mockOrgSingleFetch });
    
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelectFetch };
      }
      // For 'org_announcements' insert
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Validation error' } }) // This is for the insert().select().single()
      };
    });
    
    // Call the function and expect it to throw
    await expect(createAnnouncement({
      // orgId is not a direct param
      title: 'Test Announcement',
      content: 'This is a test'
    })).rejects.toThrow('Failed to create announcement: Validation error')
  })
})