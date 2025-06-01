import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AnnouncementProvider, useAnnouncements } from './announcement-context'
import * as announcementActions from '@/app/announcement-actions'

// Mock the announcement actions
vi.mock('@/app/announcement-actions', () => ({
  getOrganizationAnnouncements: vi.fn(),
  hasUserSeenAnnouncement: vi.fn()
}))

// Create a test component that uses the context
const TestComponent = () => {
  const { 
    announcements, 
    hasUnseenAnnouncements, 
    loading, 
    error, 
    refreshAnnouncements,
    openAnnouncementModal
  } = useAnnouncements()
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="unseen">{hasUnseenAnnouncements.toString()}</div>
      <div data-testid="count">{announcements.length}</div>
      {announcements.map(a => (
        <div key={a.id} data-testid={`announcement-${a.id}`}>
          <h3>{a.title}</h3>
          <p>{a.content}</p>
        </div>
      ))}
      <button onClick={refreshAnnouncements} data-testid="refresh-button">Refresh</button>
      <button onClick={openAnnouncementModal} data-testid="open-modal-button">Open Modal</button>
    </div>
  )
}

describe('AnnouncementContext', () => {
  const mockOpenModal = vi.fn();
  const mockSessionStorageStore: { [key: string]: string | null } = {};

  const mockSessionStorage = {
    getItem: vi.fn((key: string) => mockSessionStorageStore[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockSessionStorageStore[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockSessionStorageStore[key]; }),
    clear: vi.fn(() => {
      for (const key in mockSessionStorageStore) {
        delete mockSessionStorageStore[key];
      }
    })
  };
  
  beforeEach(() => {
    vi.resetAllMocks(); // This primarily resets mocks created with vi.mock (like announcementActions)
    mockOpenModal.mockClear();

    // Reset our custom sessionStorage mock's spies and clear its internal store
    mockSessionStorage.getItem.mockClear();
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.removeItem.mockClear();
    mockSessionStorage.clear.mockClear(); // Clears call history of the clear method itself
    mockSessionStorage.clear(); // Actually clears the store

    Object.defineProperty(window, 'openAnnouncementModal', {
      value: mockOpenModal,
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true
    });
  });

  it('provides default values when no announcements are available', async () => {
    // Mock empty announcements
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue([])

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // Initially loading should be true
    expect(screen.getByTestId('loading').textContent).toBe('true')

    // After loading, should have empty announcements
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('0')
      expect(screen.getByTestId('unseen').textContent).toBe('false')
      expect(screen.getByTestId('error').textContent).toBe('no-error')
    })
  })

  it('loads and sorts announcements correctly', async () => {
    // Mock announcements with one pinned
    const mockAnnouncements = [
      {
        id: 'announcement-1',
        title: 'Regular Announcement',
        content: 'This is a regular announcement',
        is_active: true,
        pinned_until: null,
        created_at: '2025-05-01T12:00:00.000Z'
      },
      {
        id: 'announcement-2',
        title: 'Pinned Announcement',
        content: 'This is a pinned announcement',
        is_active: true,
        pinned_until: '2025-06-01T12:00:00.000Z', // Future date
        created_at: '2025-05-01T12:00:00.000Z'
      }
    ]

    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(mockAnnouncements)
    vi.mocked(announcementActions.hasUserSeenAnnouncement).mockResolvedValue(false)

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // After loading, should have sorted announcements (pinned first)
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('count').textContent).toBe('2')
      
      // First announcement should be the pinned one
      const firstAnnouncement = screen.getByTestId('announcement-announcement-2')
      expect(firstAnnouncement).toBeInTheDocument()
      expect(firstAnnouncement.querySelector('h3')?.textContent).toBe('Pinned Announcement')
    })
  })

  it('checks if user has seen the first announcement', async () => {
    // Mock announcements
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

    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(mockAnnouncements)
    
    // Mock that user has not seen the announcement
    vi.mocked(announcementActions.hasUserSeenAnnouncement).mockResolvedValue(false)

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // After loading, hasUnseenAnnouncements should be true
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('unseen').textContent).toBe('true')
    })

    // Verify hasUserSeenAnnouncement was called with the correct ID
    expect(announcementActions.hasUserSeenAnnouncement).toHaveBeenCalledWith('announcement-1')
  })

  it('refreshes announcements when refreshAnnouncements is called', async () => {
    // Mock announcements
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

    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(mockAnnouncements)
    vi.mocked(announcementActions.hasUserSeenAnnouncement).mockResolvedValue(true)

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Reset mocks to track new calls
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockClear()
    
    // Mock new announcements for the refresh
    const newAnnouncements = [
      {
        id: 'announcement-2',
        title: 'New Announcement',
        content: 'This is a new announcement',
        is_active: true,
        pinned_until: null,
        created_at: '2025-05-02T12:00:00.000Z'
      }
    ]
    
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(newAnnouncements)
    vi.mocked(announcementActions.hasUserSeenAnnouncement).mockResolvedValue(false)

    // Click the refresh button
    const refreshButton = screen.getByTestId('refresh-button')
    await act(async () => {
      refreshButton.click()
    })

    // Verify getOrganizationAnnouncements was called again
    expect(announcementActions.getOrganizationAnnouncements).toHaveBeenCalledTimes(1)

    // After refresh, should have new announcements
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
      expect(screen.getByTestId('unseen').textContent).toBe('true')
      
      const newAnnouncementElement = screen.getByTestId('announcement-announcement-2')
      expect(newAnnouncementElement).toBeInTheDocument()
      expect(newAnnouncementElement.querySelector('h3')?.textContent).toBe('New Announcement')
    })
  })

  it('handles errors when loading announcements', async () => {
    // Mock error when loading announcements
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockRejectedValue(
      new Error('Failed to load announcements')
    )

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // After loading, should have error state
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('error').textContent).toBe('Failed to load announcements')
      expect(screen.getByTestId('count').textContent).toBe('0')
    })

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading announcements:',
      expect.any(Error)
    )

    // Restore console.error
    consoleSpy.mockRestore()
  })

  it('calls window.openAnnouncementModal when openAnnouncementModal is called', async () => {
    // Mock announcements
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue([])

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Click the open modal button
    const openModalButton = screen.getByTestId('open-modal-button')
    await act(async () => {
      openModalButton.click()
    })

    // Verify window.openAnnouncementModal was called
    expect(mockOpenModal).toHaveBeenCalled()
  })

  it('checks sessionStorage for hasUnseenAnnouncements flag', async () => {
    // Mock announcements
    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue([])
    
    // Mock sessionStorage to have the flag by setting it in our mock store
    mockSessionStorage.setItem('hasUnseenAnnouncements', 'true');
    
    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // After loading, hasUnseenAnnouncements should be true from sessionStorage
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('unseen').textContent).toBe('true')
    })

    // Verify sessionStorage was checked
    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('hasUnseenAnnouncements');
    
    // Verify sessionStorage flag was removed
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('hasUnseenAnnouncements');
  })

  it('automatically opens modal when there are unseen announcements', async () => {
    // Mock announcements
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

    vi.mocked(announcementActions.getOrganizationAnnouncements).mockResolvedValue(mockAnnouncements)
    vi.mocked(announcementActions.hasUserSeenAnnouncement).mockResolvedValue(false)
    
    // Mock sessionStorage to have the flag
    mockSessionStorage.setItem('hasUnseenAnnouncements', 'true');

    // Render the test component with the provider
    render(
      <AnnouncementProvider>
        <TestComponent />
      </AnnouncementProvider>
    )

    // After loading, modal should be opened automatically
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
      expect(screen.getByTestId('unseen').textContent).toBe('true')
      expect(mockOpenModal).toHaveBeenCalled()
    })
  })
})