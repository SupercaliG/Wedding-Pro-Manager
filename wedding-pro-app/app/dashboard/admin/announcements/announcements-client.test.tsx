import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnnouncementManagement from './announcements-client'
import * as announcementActions from '@/app/announcement-actions'

// Mock the announcement actions
vi.mock('@/app/announcement-actions', () => ({
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  getOrganizationAnnouncements: vi.fn()
}))

// Mock window.confirm
vi.spyOn(window, 'confirm').mockImplementation(() => true)

describe('AnnouncementManagement', () => {
  const mockOrgId = 'org-123'
  const mockUserRole = 'admin'
  const mockAnalytics = [
    {
      announcement_id: 'announcement-1',
      title: 'Test Announcement',
      view_count: 100,
      dismiss_count: 20,
      click_count: 30,
      click_through_rate: 30
    }
  ]

  const mockAnnouncements = [
    {
      id: 'announcement-1',
      title: 'Test Announcement',
      content: 'This is a test announcement',
      is_active: true,
      pinned_until: null,
      created_at: '2025-05-01T12:00:00.000Z',
      updated_at: '2025-05-01T12:00:00.000Z'
    },
    {
      id: 'announcement-2',
      title: 'Pinned Announcement',
      content: 'This is a pinned announcement',
      is_active: true,
      pinned_until: '2025-06-01T12:00:00.000Z',
      created_at: '2025-05-02T12:00:00.000Z',
      updated_at: '2025-05-02T12:00:00.000Z'
    },
    {
      id: 'announcement-3',
      title: 'Inactive Announcement',
      content: 'This is an inactive announcement',
      is_active: false,
      pinned_until: null,
      created_at: '2025-05-03T12:00:00.000Z',
      updated_at: '2025-05-03T12:00:00.000Z'
    }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
    
    // Mock getOrganizationAnnouncements to return test data
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(mockAnnouncements)
  })

  it('renders the announcements list correctly', async () => {
    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Initially shows loading state
    expect(screen.getByText('Loading announcements...')).toBeInTheDocument()

    // After loading, shows the announcements
    await waitFor(() => {
      expect(screen.getByText('Test Announcement')).toBeInTheDocument()
      expect(screen.getByText('Pinned Announcement')).toBeInTheDocument()
      expect(screen.getByText('Inactive Announcement')).toBeInTheDocument()
    })

    // Check that pinned badge is displayed
    expect(screen.getByText('Pinned')).toBeInTheDocument()

    // Check that inactive badge is displayed
    expect(screen.getByText('Inactive')).toBeInTheDocument()

    // Check that analytics are displayed
    expect(screen.getByText('100 views')).toBeInTheDocument()
    expect(screen.getByText('30 clicks')).toBeInTheDocument()
    expect(screen.getByText('30% CTR')).toBeInTheDocument()
  })

  it('allows creating a new announcement', async () => {
    // Mock createAnnouncement to return a new announcement
    const newAnnouncement = {
      id: 'new-announcement',
      title: 'New Announcement',
      content: 'This is a new announcement',
      is_active: true,
      pinned_until: null,
      created_at: '2025-05-10T12:00:00.000Z',
      updated_at: '2025-05-10T12:00:00.000Z'
    }
    
    vi.mocked(announcementActions.createAnnouncement).mockResolvedValue(newAnnouncement)

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Click the "New Announcement" button
    const user = userEvent.setup()
    await user.click(screen.getByText('New Announcement'))

    // Dialog should be open with form
    expect(screen.getByText('Create New Announcement')).toBeInTheDocument()

    // Fill out the form
    await user.type(screen.getByLabelText('Title'), 'New Announcement')
    await user.type(screen.getByLabelText('Content'), 'This is a new announcement')
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Create' }))

    // Check that createAnnouncement was called with correct data
    expect(announcementActions.createAnnouncement).toHaveBeenCalledWith({
      orgId: mockOrgId,
      title: 'New Announcement',
      content: 'This is a new announcement',
      isActive: true,
      pinnedUntil: null
    })

    // New announcement should be added to the list
    await waitFor(() => {
      expect(screen.getByText('New Announcement')).toBeInTheDocument()
    })
  })

  it('allows editing an existing announcement', async () => {
    // Mock updateAnnouncement to return updated announcement
    const updatedAnnouncement = {
      ...mockAnnouncements[0],
      title: 'Updated Announcement',
      content: 'This announcement has been updated',
      is_active: false
    }
    
    vi.mocked(announcementActions.updateAnnouncement).mockResolvedValue(updatedAnnouncement)

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Find and click the edit button for the first announcement
    const user = userEvent.setup()
    
    // Find the edit button in the first announcement card
    const firstAnnouncementCard = screen.getByText('Test Announcement').closest('div[class*="border rounded-lg"]')
    const editButton = firstAnnouncementCard?.querySelector('button')
    expect(editButton).not.toBeNull()
    
    await user.click(editButton!)

    // Dialog should be open with form pre-filled
    expect(screen.getByText('Edit Announcement')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Test Announcement')
    expect(screen.getByLabelText('Content')).toHaveValue('This is a test announcement')

    // Update the form
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Updated Announcement')
    await user.clear(screen.getByLabelText('Content'))
    await user.type(screen.getByLabelText('Content'), 'This announcement has been updated')
    
    // Toggle active status
    await user.click(screen.getByLabelText('Active'))
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Update' }))

    // Check that updateAnnouncement was called with correct data
    expect(announcementActions.updateAnnouncement).toHaveBeenCalledWith({
      id: 'announcement-1',
      title: 'Updated Announcement',
      content: 'This announcement has been updated',
      isActive: false,
      pinnedUntil: null
    })

    // Updated announcement should be in the list
    await waitFor(() => {
      expect(screen.getByText('Updated Announcement')).toBeInTheDocument()
      expect(screen.getByText('This announcement has been updated')).toBeInTheDocument()
    })
  })

  it('allows deleting an announcement', async () => {
    // Mock deleteAnnouncement to return success
    vi.mocked(announcementActions.deleteAnnouncement).mockResolvedValue({ success: true })

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Find and click the delete button for the first announcement
    const user = userEvent.setup()
    
    // Find the delete button in the first announcement card
    const firstAnnouncementCard = screen.getByText('Test Announcement').closest('div[class*="border rounded-lg"]')
    const deleteButton = firstAnnouncementCard?.querySelectorAll('button')[1] // Second button should be delete
    expect(deleteButton).not.toBeNull()
    
    await user.click(deleteButton!)

    // Check that confirm was called
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this announcement?')

    // Check that deleteAnnouncement was called with correct ID
    expect(announcementActions.deleteAnnouncement).toHaveBeenCalledWith('announcement-1')

    // Announcement should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Test Announcement')).not.toBeInTheDocument()
    })
  })

  it('allows toggling between announcements and analytics tabs', async () => {
    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Initially on announcements tab
    expect(screen.getByText('Test Announcement')).toBeInTheDocument()

    // Click the analytics tab
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Analytics' }))

    // Should show analytics content
    expect(screen.getByText('Announcement Analytics')).toBeInTheDocument()
    
    // Should show analytics table headers
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Dismissals')).toBeInTheDocument()
    expect(screen.getByText('CTR')).toBeInTheDocument()

    // Click back to announcements tab
    await user.click(screen.getByRole('tab', { name: 'Announcements' }))

    // Should show announcements again
    expect(screen.getByText('Test Announcement')).toBeInTheDocument()
  })

  it('allows creating a pinned announcement', async () => {
    // Mock createAnnouncement to return a new pinned announcement
    const newPinnedAnnouncement = {
      id: 'new-pinned-announcement',
      title: 'New Pinned Announcement',
      content: 'This is a new pinned announcement',
      is_active: true,
      pinned_until: '2025-06-01T12:00:00.000Z',
      created_at: '2025-05-10T12:00:00.000Z',
      updated_at: '2025-05-10T12:00:00.000Z'
    }
    
    vi.mocked(announcementActions.createAnnouncement).mockResolvedValue(newPinnedAnnouncement)

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Click the "New Announcement" button
    const user = userEvent.setup()
    await user.click(screen.getByText('New Announcement'))

    // Dialog should be open with form
    expect(screen.getByText('Create New Announcement')).toBeInTheDocument()

    // Fill out the form
    await user.type(screen.getByLabelText('Title'), 'New Pinned Announcement')
    await user.type(screen.getByLabelText('Content'), 'This is a new pinned announcement')
    
    // Toggle pin switch
    await user.click(screen.getByLabelText('Pin Announcement'))
    
    // Pin days input should appear
    expect(screen.getByLabelText('Pin for how many days?')).toBeInTheDocument()
    
    // Change pin days
    await user.clear(screen.getByLabelText('Pin for how many days?'))
    await user.type(screen.getByLabelText('Pin for how many days?'), '14')
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Create' }))

    // Check that createAnnouncement was called with correct data including pinnedUntil
    expect(announcementActions.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: mockOrgId,
        title: 'New Pinned Announcement',
        content: 'This is a new pinned announcement',
        isActive: true,
        pinnedUntil: expect.any(Date)
      })
    )

    // New pinned announcement should be added to the list
    await waitFor(() => {
      expect(screen.getByText('New Pinned Announcement')).toBeInTheDocument()
    })
  })

  it('handles errors during announcement loading', async () => {
    // Mock error when loading announcements
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockRejectedValue(
      new Error('Failed to load announcements')
    )

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // After loading, should show error message
    await waitFor(() => {
      expect(screen.getByText('Failed to load announcements')).toBeInTheDocument()
    })

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading announcements:',
      expect.any(Error)
    )

    // Restore console.error
    consoleSpy.mockRestore()
  })

  it('handles errors during announcement creation', async () => {
    // Mock error when creating announcement
    vi.mocked(announcementActions.createAnnouncement).mockRejectedValue(
      new Error('Failed to create announcement')
    )

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Render the component
    render(
      <AnnouncementManagement
        orgId={mockOrgId}
        userRole={mockUserRole}
        initialAnalytics={mockAnalytics}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading announcements...')).not.toBeInTheDocument()
    })

    // Click the "New Announcement" button
    const user = userEvent.setup()
    await user.click(screen.getByText('New Announcement'))

    // Fill out the form
    await user.type(screen.getByLabelText('Title'), 'New Announcement')
    await user.type(screen.getByLabelText('Content'), 'This is a new announcement')
    
    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Create' }))

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Failed to create announcement')).toBeInTheDocument()
    })

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error saving announcement:',
      expect.any(Error)
    )

    // Restore console.error
    consoleSpy.mockRestore()
  })
})