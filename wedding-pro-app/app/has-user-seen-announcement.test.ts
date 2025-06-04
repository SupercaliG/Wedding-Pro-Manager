import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hasUserSeenAnnouncement } from './announcement-actions'
import { createClient } from '@/utils/supabase/server'
// revalidatePath is not used by this function

// Mock dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}))

describe('hasUserSeenAnnouncement', () => {
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
    limit: vi.fn().mockReturnThis(), // Specific to this function's query
    single: vi.fn()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when user has seen the announcement', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    })
    mockSupabase.limit.mockResolvedValueOnce({ // Mock for the .limit(1) call
      data: [{ id: 'engagement-123' }], // Indicates an engagement record was found
      error: null
    })

    const result = await hasUserSeenAnnouncement('announcement-123')

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
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    })
    mockSupabase.limit.mockResolvedValueOnce({ // Mock for the .limit(1) call
      data: [], // No engagement record found
      error: null
    })

    const result = await hasUserSeenAnnouncement('announcement-never-seen')

    expect(result).toBe(false)
  })

  it('should throw an error when unauthorized', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null }, // Simulating no user
      error: { message: 'Not authenticated' } // Or null, function handles both
    })

    await expect(hasUserSeenAnnouncement('announcement-123')).rejects.toThrow('Unauthorized')
  })

  it('should throw an error if Supabase query fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    })
    mockSupabase.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database query failed' }
    })

    await expect(hasUserSeenAnnouncement('announcement-123'))
      .rejects.toThrow('Failed to check if user has seen announcement: Database query failed')
  })
})