import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnnouncementModal from './announcement-modal'
import { AnnouncementProvider } from '@/contexts/announcement-context'
import * as announcementActions from '@/app/announcement-actions'

// Mock the announcement actions
vi.mock('@/app/announcement-actions', () => ({
  trackAnnouncementEngagement: vi.fn().mockResolvedValue({}),
  getRecentEngagements: vi.fn().mockResolvedValue([])
}))

// Mock the announcement context
vi.mock('@/contexts/announcement-context', () => ({
  useAnnouncements: vi.fn(),
  AnnouncementProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

describe('AnnouncementModal', () => {
  // Mock window.openAnnouncementModal
  const originalWindow = { ...window }
  
  beforeEach(() => {
    vi.resetAllMocks()
    
    // Restore window to original state
    Object.defineProperty(global, 'window', {
      value: { ...originalWindow },
      writable: true
    })
  })

  const mockAnnouncements = [
    {
      id: 'announcement-1',
      title: 'Test Announcement',
      content: 'This is a test announcement',
      is_active: true,
      pinned_until: null,
      created_at: '2025-05-01T12:00:00.000Z'
    }
  ]

  const mockPinnedAnnouncement = {
    id: 'announcement-2',
    title: 'Pinned Announcement',
    content: 'This is a pinned announcement',
    is_active: true,
    pinned_until: '2025-06-01T12:00:00.000Z',
    created_at: '2025-05-01T12:00:00.000Z'
  }

  const mockMultipleAnnouncements = [
    mockAnnouncements[0],
    {
      id: 'announcement-3',
      title: 'Second Announcement',
      content: 'This is another announcement',
      is_active: true,
      pinned_until: null,
      created_at: '2025-05-02T12:00:00.000Z'
    }
  ]

  const mockAnnouncementContext = {
    announcements: mockAnnouncements,
    hasUnseenAnnouncements: false,
    loading: false,
    error: null,
    refreshAnnouncements: vi.fn().mockResolvedValue(undefined),
    openAnnouncementModal: vi.fn()
  }

  it('renders correctly with announcement data', async () => {
    // Setup mock context
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: mockAnnouncements
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Check that the modal renders with correct data
    await waitFor(() => {
      expect(screen.getByText('Test Announcement')).toBeInTheDocument()
      expect(screen.getByText('This is a test announcement')).toBeInTheDocument()
      expect(screen.getByText(/Posted on May 1, 2025/)).toBeInTheDocument()
    })
  })

  it('displays pinned badge for pinned announcements', async () => {
    // Setup mock context with pinned announcement
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: [mockPinnedAnnouncement]
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Check that the pinned badge is displayed
    await waitFor(() => {
      expect(screen.getByText('Pinned')).toBeInTheDocument()
    })
  })

  it('tracks view engagement when modal opens', async () => {
    // Setup mock context
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: mockAnnouncements
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Check that view tracking was called
    await waitFor(() => {
      expect(announcementActions.trackAnnouncementEngagement).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementId: 'announcement-1',
          engagementType: 'view',
          metadata: expect.any(Object)
        })
      )
    })
  })

  it('tracks dismiss engagement when modal closes', async () => {
    // Setup mock context
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: mockAnnouncements
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Find and click the close button
    const user = userEvent.setup()
    const closeButton = await screen.findByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Check that dismiss tracking was called
    await waitFor(() => {
      expect(announcementActions.trackAnnouncementEngagement).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementId: 'announcement-1',
          engagementType: 'dismiss',
          metadata: expect.objectContaining({
            dismiss_source: 'close_button'
          })
        })
      )
    })
  })

  it('tracks click engagement when links are clicked', async () => {
    // Setup mock context with content containing a link
    const announcementWithLink = {
      ...mockAnnouncements[0],
      content: 'Check out https://example.com for more information'
    }

    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: [announcementWithLink]
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Find and click the link
    const user = userEvent.setup()
    const link = await screen.findByText('https://example.com')
    await user.click(link)

    // Check that click tracking was called
    await waitFor(() => {
      expect(announcementActions.trackAnnouncementEngagement).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementId: 'announcement-1',
          engagementType: 'click',
          metadata: expect.objectContaining({
            url: 'https://example.com',
            element_type: 'link'
          })
        })
      )
    })
  })

  it('allows navigation between multiple announcements', async () => {
    // Setup mock context with multiple announcements
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: mockMultipleAnnouncements
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Check that the first announcement is displayed
    await waitFor(() => {
      expect(screen.getByText('Test Announcement')).toBeInTheDocument()
      expect(screen.getByText('1 of 2')).toBeInTheDocument()
    })

    // Click the next button
    const user = userEvent.setup()
    const nextButton = await screen.findByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Check that the second announcement is displayed
    await waitFor(() => {
      expect(screen.getByText('Second Announcement')).toBeInTheDocument()
      expect(screen.getByText('2 of 2')).toBeInTheDocument()
    })

    // Click the previous button
    const prevButton = await screen.findByRole('button', { name: /previous/i })
    await user.click(prevButton)

    // Check that the first announcement is displayed again
    await waitFor(() => {
      expect(screen.getByText('Test Announcement')).toBeInTheDocument()
    })
  })

  it('refreshes announcements after closing the modal', async () => {
    // Setup mock context
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined)
    
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      refreshAnnouncements: refreshAnnouncementsMock
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Find and click the close button
    const user = userEvent.setup()
    const closeButton = await screen.findByRole('button', { name: /close/i })
    await user.click(closeButton)

    // Check that refreshAnnouncements was called after a delay
    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('handles accessibility attributes correctly', async () => {
    // Setup mock context
    const useAnnouncementsMock = vi.spyOn(require('@/contexts/announcement-context'), 'useAnnouncements')
    useAnnouncementsMock.mockReturnValue({
      ...mockAnnouncementContext,
      announcements: mockAnnouncements
    })

    // Render the component
    render(<AnnouncementModal />)

    // Open the modal programmatically
    window.openAnnouncementModal?.()

    // Check that the dialog has the correct role and attributes
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      
      // Check that the close button is accessible
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
      
      // Check that the title is properly associated with the dialog
      const title = screen.getByText('Test Announcement')
      expect(title).toBeInTheDocument()
    })
  })
})