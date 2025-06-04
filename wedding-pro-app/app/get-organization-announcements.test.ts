import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest'
import { getOrganizationAnnouncements } from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
// revalidatePath is not used by getOrganizationAnnouncements

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

// Mock next/cache if other functions in this file might use it, but not for getOrganizationAnnouncements
// vi.mock('next/cache', () => ({
//   revalidatePath: vi.fn()
// }))

describe('getOrganizationAnnouncements', () => {
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

  let consoleWarnSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks()
    ;(createClient as any).mockResolvedValue(mockSupabase)
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks()
  })

  it('should fetch all announcements when user and org are valid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })

    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });

    const mockAnnouncementOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'announcement-1', title: 'First Announcement', org_id: 'org-uuid-123' },
        { id: 'announcement-2', title: 'Second Announcement', org_id: 'org-uuid-123' }
      ],
      error: null
    });
    const mockAnnouncementEq = vi.fn().mockReturnThis();
    const mockAnnouncementSelect = vi.fn().mockReturnValue({ eq: mockAnnouncementEq, order: mockAnnouncementOrder });
    
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { select: mockAnnouncementSelect };
      }
      return mockSupabase;
    });

    const result = await getOrganizationAnnouncements({ onlyActive: false, onlyPinned: false })

    expect(createClient).toHaveBeenCalled()
    expect(mockSupabase.auth.getUser).toHaveBeenCalled()
    expect(mockSupabase.from).toHaveBeenCalledWith('orgs');
    expect(mockOrgSelect).toHaveBeenCalledWith('id');
    expect(mockOrgEq).toHaveBeenCalledWith('organization_id', 'org-text-id-123');
    expect(mockSupabase.from).toHaveBeenCalledWith('org_announcements');
    expect(mockAnnouncementSelect).toHaveBeenCalledWith('*');
    expect(mockAnnouncementEq).toHaveBeenCalledWith('org_id', 'org-uuid-123');
    expect(mockAnnouncementOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([
      { id: 'announcement-1', title: 'First Announcement', org_id: 'org-uuid-123' },
      { id: 'announcement-2', title: 'Second Announcement', org_id: 'org-uuid-123' }
    ])
  })

  it('should fetch only active announcements', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    })
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis(); // For orgs table
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });

    const mockAnnouncementOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'announcement-1', title: 'Active Announcement', is_active: true, org_id: 'org-uuid-123' }],
      error: null
    });
    const mockAnnouncementEqActive = vi.fn().mockReturnThis(); // For is_active filter
    const mockAnnouncementEqOrg = vi.fn().mockReturnValue({ eq: mockAnnouncementEqActive, order: mockAnnouncementOrder }); // For org_id filter
    const mockAnnouncementSelect = vi.fn().mockReturnValue({ eq: mockAnnouncementEqOrg });
    
    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') {
        return { select: mockOrgSelect };
      }
      if (tableName === 'org_announcements') {
        return { select: mockAnnouncementSelect };
      }
      return mockSupabase;
    });

    const result = await getOrganizationAnnouncements({ onlyActive: true, onlyPinned: false })

    expect(mockAnnouncementEqOrg).toHaveBeenCalledWith('org_id', 'org-uuid-123');
    expect(mockAnnouncementEqActive).toHaveBeenCalledWith('is_active', true);
    expect(result).toEqual([{ id: 'announcement-1', title: 'Active Announcement', is_active: true, org_id: 'org-uuid-123' }])
  })

  it('should fetch only pinned announcements', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    });
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });

    const mockAnnouncementOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'announcement-pinned', title: 'Pinned', pinned_until: new Date(Date.now() + 86400000).toISOString(), org_id: 'org-uuid-123' }],
      error: null
    });
    const mockAnnouncementGte = vi.fn().mockReturnThis();
    const mockAnnouncementNot = vi.fn().mockReturnValue({ gte: mockAnnouncementGte, order: mockAnnouncementOrder });
    const mockAnnouncementEqOrg = vi.fn().mockReturnValue({ not: mockAnnouncementNot });
    const mockAnnouncementSelect = vi.fn().mockReturnValue({ eq: mockAnnouncementEqOrg });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') return { select: mockOrgSelect };
      if (tableName === 'org_announcements') return { select: mockAnnouncementSelect };
      return mockSupabase;
    });

    const result = await getOrganizationAnnouncements({ onlyActive: false, onlyPinned: true });

    expect(mockAnnouncementEqOrg).toHaveBeenCalledWith('org_id', 'org-uuid-123');
    expect(mockAnnouncementNot).toHaveBeenCalledWith('pinned_until', 'is', null);
    expect(mockAnnouncementGte).toHaveBeenCalledWith('pinned_until', expect.any(String)); // Check it's a date string
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Pinned');
  });


  it('should return empty array and log warning if user not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null // or an error object, function handles both
    })

    const result = await getOrganizationAnnouncements()
    
    expect(result).toEqual([])
    expect(consoleWarnSpy).toHaveBeenCalledWith("getOrganizationAnnouncements: User not authenticated. Returning empty array.");
    expect(mockSupabase.from).not.toHaveBeenCalledWith('orgs'); // Should not proceed to org fetch
    expect(mockSupabase.from).not.toHaveBeenCalledWith('org_announcements');
  })

  it('should return empty array and log warning if no active_org_id in JWT', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: {} } }, // No active_org_id
      error: null
    });

    const result = await getOrganizationAnnouncements();

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith("getOrganizationAnnouncements: No active organization ID found in JWT. Returning empty array.");
    expect(mockSupabase.from).not.toHaveBeenCalledWith('orgs');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('org_announcements');
  });
  
  it('should return empty array and log warning if org details fetch fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    });

    const mockOrgSingleFail = vi.fn().mockResolvedValue({ data: null, error: { message: 'Org fetch failed' } });
    const mockOrgEqFail = vi.fn().mockReturnThis();
    const mockOrgSelectFail = vi.fn().mockReturnValue({ eq: mockOrgEqFail, single: mockOrgSingleFail });

    mockSupabase.from.mockImplementationOnce((tableName: string) => { // For 'orgs' call
      if (tableName === 'orgs') {
        return { select: mockOrgSelectFail };
      }
      return mockSupabase;
    });

    const result = await getOrganizationAnnouncements();

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `getOrganizationAnnouncements: Could not find org details for active_org_id org-text-id-123. Returning empty. Error: Org fetch failed`
    );
    expect(mockSupabase.from).toHaveBeenCalledWith('orgs');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('org_announcements');
  });

  it('should return empty array and log error if fetching announcements fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { active_org_id: 'org-text-id-123' } } },
      error: null
    });
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { id: 'org-uuid-123' }, error: null });
    const mockOrgEq = vi.fn().mockReturnThis();
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq, single: mockOrgSingle });

    const mockAnnouncementOrderFail = vi.fn().mockResolvedValue({ data: null, error: { message: 'Announcements fetch failed' } });
    const mockAnnouncementEqOrgFail = vi.fn().mockReturnThis();
    const mockAnnouncementSelectFail = vi.fn().mockReturnValue({ eq: mockAnnouncementEqOrgFail, order: mockAnnouncementOrderFail });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'orgs') return { select: mockOrgSelect };
      if (tableName === 'org_announcements') return { select: mockAnnouncementSelectFail };
      return mockSupabase;
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});


    const result = await getOrganizationAnnouncements({ onlyActive: false });

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Failed to fetch announcements for org UUID org-uuid-123: Announcements fetch failed`
    );
    consoleErrorSpy.mockRestore();
  });
})