import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import PostLoginAnnouncementHandler from './post-login-announcement-handler'
import { useAnnouncements } from '@/contexts/announcement-context'

// Mock the Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

// Mock the announcement context
vi.mock('@/contexts/announcement-context', () => ({
  useAnnouncements: vi.fn()
}))

describe('PostLoginAnnouncementHandler', () => {
  // Mock sessionStorage
  const mockSessionStorage = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      })
    }
  })()

  beforeEach(() => {
    vi.resetAllMocks()
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    })
    
    mockSessionStorage.clear()
    
    // Mock router
    vi.mocked(require('next/navigation').useRouter).mockReturnValue({
      push: vi.fn()
    })
  })

  it('redirects to dashboard after checking announcements', async () => {
    // Setup mock context with no announcements
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAnnouncements).mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    })

    // Render the component
    render(<PostLoginAnnouncementHandler />)

    // Check that refreshAnnouncements was called
    expect(refreshAnnouncementsMock).toHaveBeenCalled()

    // Check that router.push was called with the correct path
    await waitFor(() => {
      expect(require('next/navigation').useRouter().push).toHaveBeenCalledWith('/dashboard')
    })

    // Check that no flag was set in sessionStorage
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
  })

  it('sets sessionStorage flag when there are unseen announcements', async () => {
    // Setup mock context with unseen announcements
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAnnouncements).mockReturnValue({
      announcements: [
        {
          id: 'announcement-1',
          title: 'Test Announcement',
          content: 'This is a test announcement',
          is_active: true,
          pinned_until: null,
          created_at: '2025-05-01T12:00:00.000Z'
        }
      ],
      hasUnseenAnnouncements: true,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    })

    // Render the component
    render(<PostLoginAnnouncementHandler />)

    // Check that refreshAnnouncements was called
    expect(refreshAnnouncementsMock).toHaveBeenCalled()

    // Check that the flag was set in sessionStorage
    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('hasUnseenAnnouncements', 'true')
    })

    // Check that router.push was called with the correct path
    await waitFor(() => {
      expect(require('next/navigation').useRouter().push).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('handles errors during announcement refresh', async () => {
    // Setup mock context with error
    const refreshAnnouncementsMock = vi.fn().mockRejectedValue(new Error('Failed to fetch announcements'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    vi.mocked(useAnnouncements).mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    })

    // Render the component
    render(<PostLoginAnnouncementHandler />)

    // Check that refreshAnnouncements was called
    expect(refreshAnnouncementsMock).toHaveBeenCalled()

    // Check that error was logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error checking announcements:', expect.any(Error))
    })

    // Check that router.push was still called (redirect happens regardless of error)
    await waitFor(() => {
      expect(require('next/navigation').useRouter().push).toHaveBeenCalledWith('/dashboard')
    })

    // Restore console.error
    consoleSpy.mockRestore()
  })

  it('does not set flag when there are no announcements', async () => {
    // Setup mock context with no announcements
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAnnouncements).mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    })

    // Render the component
    render(<PostLoginAnnouncementHandler />)

    // Check that refreshAnnouncements was called
    expect(refreshAnnouncementsMock).toHaveBeenCalled()

    // Check that no flag was set in sessionStorage
    await waitFor(() => {
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })
  })

  it('does not set flag when announcements exist but all have been seen', async () => {
    // Setup mock context with seen announcements
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAnnouncements).mockReturnValue({
      announcements: [
        {
          id: 'announcement-1',
          title: 'Test Announcement',
          content: 'This is a test announcement',
          is_active: true,
          pinned_until: null,
          created_at: '2025-05-01T12:00:00.000Z'
        }
      ],
      hasUnseenAnnouncements: false, // All announcements have been seen
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    })

    // Render the component
    render(<PostLoginAnnouncementHandler />)

    // Check that refreshAnnouncements was called
    expect(refreshAnnouncementsMock).toHaveBeenCalled()

    // Check that no flag was set in sessionStorage
    await waitFor(() => {
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })
  })
})