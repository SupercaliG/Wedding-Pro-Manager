/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import PostLoginAnnouncementHandler from './post-login-announcement-handler';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { mockSessionStorage } from '../test/setup';
import { AnnouncementProvider } from '@/contexts/announcement-context';

// --- Mocks ---

// 1. Mock server actions from announcement-actions.ts
vi.mock('@/app/announcement-actions', () => ({
  getOrganizationAnnouncements: vi.fn().mockResolvedValue([]),
  hasUserSeenAnnouncement: vi.fn().mockResolvedValue(false),
}));

// 2. Mock the server-side Supabase client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

// 3. Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRouterObject = { // Define the router object that mockUseRouter will return
  push: mockPush,
  replace: mockReplace,
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};
const mockUseRouter = vi.fn(() => mockRouterObject);

vi.mock('next/navigation', () => ({
  useRouter: mockUseRouter,
  usePathname: vi.fn().mockReturnValue('/mock-path'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// 4. Mock for useAnnouncements (from context)
const mockUseAnnouncements = vi.fn();
vi.mock('@/contexts/announcement-context', () => {
  // Import the actual provider to wrap the component, but mock the hook
  const OriginalModule = vi.importActual('@/contexts/announcement-context');
  return {
    ...OriginalModule,
    useAnnouncements: mockUseAnnouncements,
  };
});


describe('PostLoginAnnouncementHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSessionStorage.clear();
    // mockPush and mockReplace are part of mockRouterObject, 
    // mockUseRouter returns this object.
    // Clearing individual methods on mockRouterObject if needed:
    mockPush.mockClear();
    mockReplace.mockClear();
    // Or, if mockUseRouter itself needs to be reset for different return values per test:
    // mockUseRouter.mockClear(); // And then re-assign .mockReturnValue(...) in tests if needed.
    
    // Reset the mock implementation for useAnnouncements
    mockUseAnnouncements.mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: vi.fn().mockResolvedValue(undefined),
      openAnnouncementModal: vi.fn()
    });
  });

  const renderComponent = () => {
    return render(
      // Pass the defined mockRouterObject to the provider
      <AppRouterContext.Provider value={mockRouterObject}> 
        <AnnouncementProvider>
          <PostLoginAnnouncementHandler />
        </AnnouncementProvider>
      </AppRouterContext.Provider>
    );
  };

  it('redirects to dashboard after checking announcements', async () => {
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined);
    // Ensure the mock for useAnnouncements is providing our test-specific refresh mock
    mockUseAnnouncements.mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    });

    renderComponent();

    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
  });

  it('sets sessionStorage flag when there are unseen announcements', async () => {
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined);
    mockUseAnnouncements.mockReturnValue({
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
    });

    renderComponent();

    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('hasUnseenAnnouncements', 'true');
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles errors during announcement refresh', async () => {
    const refreshAnnouncementsMock = vi.fn().mockRejectedValue(new Error('Failed to fetch announcements'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockUseAnnouncements.mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    });

    renderComponent();

    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error checking announcements:', expect.any(Error));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    consoleSpy.mockRestore();
  });

  it('does not set flag when there are no announcements', async () => {
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined);
    mockUseAnnouncements.mockReturnValue({
      announcements: [],
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    });

    renderComponent();

    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  it('does not set flag when announcements exist but all have been seen', async () => {
    const refreshAnnouncementsMock = vi.fn().mockResolvedValue(undefined);
    mockUseAnnouncements.mockReturnValue({
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
      hasUnseenAnnouncements: false,
      loading: false,
      error: null,
      refreshAnnouncements: refreshAnnouncementsMock,
      openAnnouncementModal: vi.fn()
    });

    renderComponent();

    await waitFor(() => {
      expect(refreshAnnouncementsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });
});