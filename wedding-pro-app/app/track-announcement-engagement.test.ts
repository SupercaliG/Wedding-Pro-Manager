import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest'
import { trackAnnouncementEngagement, getRecentEngagements } from './announcement-actions'
import * as announcementActions from './announcement-actions' // For spying on getRecentEngagements
import { createClient } from '@/utils/supabase/server'
// revalidatePath is not used by these functions

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

describe('trackAnnouncementEngagement', () => {
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

  let getRecentEngagementsSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks()
    ;(createClient as any).mockResolvedValue(mockSupabase)
    // Spy on and mock getRecentEngagements for each test in this describe block
    // Important: We are spying on the actual imported getRecentEngagements from announcementActions module
    getRecentEngagementsSpy = vi.spyOn(announcementActions, 'getRecentEngagements');

     // Default user mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });
  })

  afterEach(() => {
    getRecentEngagementsSpy.mockRestore();
    vi.clearAllMocks()
  })

  it('should track view engagement', async () => {
    mockSupabase.single.mockResolvedValueOnce({ // For the insert().select().single()
      data: {
        id: 'engagement-123',
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'view',
        metadata: { client_timestamp: expect.any(String) }
      },
      error: null
    })
    
    getRecentEngagementsSpy.mockResolvedValueOnce([]); // For initial check, no recent views

    const result = await trackAnnouncementEngagement({
      announcementId: 'announcement-123',
      engagementType: 'view'
    })
    
    expect(getRecentEngagementsSpy).toHaveBeenCalled();
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
    mockSupabase.single.mockResolvedValueOnce({ // For the insert().select().single()
      data: {
        id: 'engagement-123',
        announcement_id: 'announcement-123',
        user_id: 'user-123',
        engagement_type: 'dismiss',
        metadata: { client_timestamp: expect.any(String) }
      },
      error: null
    })

    getRecentEngagementsSpy.mockResolvedValueOnce([]) // No duplicates

    const result = await trackAnnouncementEngagement({
      announcementId: 'announcement-123',
      engagementType: 'dismiss',
      metadata: { dismiss_source: 'close_button' }
    })

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
    const recentEngagement = {
      id: 'engagement-existing',
      announcement_id: 'announcement-123',
      user_id: 'user-123',
      engagement_type: 'view',
      created_at: new Date().toISOString(),
      metadata: { client_timestamp: new Date().toISOString() }
    }
    getRecentEngagementsSpy.mockResolvedValueOnce([recentEngagement])

    const result = await trackAnnouncementEngagement({
      announcementId: 'announcement-123',
      engagementType: 'view',
      deduplicate: true
    })

    expect(getRecentEngagementsSpy).toHaveBeenCalledWith({
      announcementId: 'announcement-123',
      engagementType: 'view',
      timeWindowSeconds: expect.any(Number)
    })
    expect(result).toEqual(recentEngagement)
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('should throw "Unauthorized" if user is not found for trackEngagement', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    getRecentEngagementsSpy.mockRejectedValue(new Error('Unauthorized')); // Prevent spy from being an issue

    await expect(trackAnnouncementEngagement({
      announcementId: 'announcement-123',
      engagementType: 'view'
    })).rejects.toThrow('Unauthorized');
  });

  it('should throw "Failed to track engagement" if insert fails', async () => {
    getRecentEngagementsSpy.mockResolvedValueOnce([]); // No duplicates
    mockSupabase.single.mockResolvedValueOnce({ // For the insert().select().single()
        data: null,
        error: { message: 'Insert failed' }
    });

    await expect(trackAnnouncementEngagement({
      announcementId: 'announcement-123',
      engagementType: 'view'
    })).rejects.toThrow('Failed to track engagement: Insert failed');
  });
})

describe('getRecentEngagements', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }) // Default to empty success
  }

  beforeEach(() => {
    vi.resetAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should query for recent engagements correctly', async () => {
    const announcementId = 'announce-abc';
    const engagementType = 'view';
    const timeWindowSeconds = 300;
    const expectedTimeWindow = new Date();
    expectedTimeWindow.setSeconds(expectedTimeWindow.getSeconds() - timeWindowSeconds);

    const mockData = [{ id: 'engagement-1', type: 'view' }];
    mockSupabase.order.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await getRecentEngagements({ announcementId, engagementType, timeWindowSeconds });

    expect(createClient).toHaveBeenCalled();
    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('announcement_engagements');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(mockSupabase.eq).toHaveBeenCalledWith('announcement_id', announcementId);
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockSupabase.eq).toHaveBeenCalledWith('engagement_type', engagementType);
    expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', expectedTimeWindow.toISOString());
    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual(mockData);
  });

  it('should throw "Unauthorized" if user is not found for getRecentEngagements', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(getRecentEngagements({ announcementId: 'any', engagementType: 'view' }))
      .rejects.toThrow('Unauthorized');
  });

  it('should throw "Failed to get recent engagements" if Supabase query fails', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    await expect(getRecentEngagements({ announcementId: 'any', engagementType: 'view' }))
      .rejects.toThrow('Failed to get recent engagements: DB error');
  });
});