'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { 
  getOrganizationAnnouncements,
  hasUserSeenAnnouncement
} from '@/app/announcement-actions'

// Define the type for an announcement
type Announcement = {
  id: string
  title: string
  content: string
  is_active: boolean
  pinned_until: string | null
  created_at: string
}

// Define the context type
type AnnouncementContextType = {
  announcements: Announcement[]
  hasUnseenAnnouncements: boolean
  loading: boolean
  error: string | null
  refreshAnnouncements: () => Promise<void>
  openAnnouncementModal: () => void
}

// Create the context with a default value
const AnnouncementContext = createContext<AnnouncementContextType>({
  announcements: [],
  hasUnseenAnnouncements: false,
  loading: false,
  error: null,
  refreshAnnouncements: async () => {},
  openAnnouncementModal: () => {}
})

// Hook to use the announcement context
export const useAnnouncements = () => useContext(AnnouncementContext)

// Provider component
export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [hasUnseenAnnouncements, setHasUnseenAnnouncements] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function to refresh announcements
  const refreshAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch active announcements
      const data = await getOrganizationAnnouncements({ onlyActive: true })
      
      if (data && data.length > 0) {
        // Sort to prioritize pinned announcements
        const sortedAnnouncements = [...data].sort((a, b) => {
          const aIsPinned = a.pinned_until && new Date(a.pinned_until) > new Date()
          const bIsPinned = b.pinned_until && new Date(b.pinned_until) > new Date()
          
          if (aIsPinned && !bIsPinned) return -1
          if (!aIsPinned && bIsPinned) return 1
          return 0
        })
        
        setAnnouncements(sortedAnnouncements)
        
        // Check if user has already seen the first announcement
        const firstAnnouncementId = sortedAnnouncements[0].id
        const seen = await hasUserSeenAnnouncement(firstAnnouncementId)
        
        setHasUnseenAnnouncements(!seen)
      } else {
        setAnnouncements([])
        setHasUnseenAnnouncements(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements')
      console.error('Error loading announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  // Function to open the announcement modal
  const openAnnouncementModal = () => {
    if (typeof window !== 'undefined' && window.openAnnouncementModal) {
      window.openAnnouncementModal()
    }
  }

  // Load announcements on mount
  useEffect(() => {
    refreshAnnouncements()
  }, [])

  // Check for the flag set by PostLoginAnnouncementHandler
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasFlag = sessionStorage.getItem('hasUnseenAnnouncements') === 'true'
      
      if (hasFlag) {
        setHasUnseenAnnouncements(true)
        sessionStorage.removeItem('hasUnseenAnnouncements')
      }
    }
  }, [])

  // Automatically open the modal if there are unseen announcements
  useEffect(() => {
    if (hasUnseenAnnouncements && announcements.length > 0) {
      openAnnouncementModal()
    }
  }, [hasUnseenAnnouncements, announcements])

  return (
    <AnnouncementContext.Provider
      value={{
        announcements,
        hasUnseenAnnouncements,
        loading,
        error,
        refreshAnnouncements,
        openAnnouncementModal
      }}
    >
      {children}
    </AnnouncementContext.Provider>
  )
}

// Add the window.openAnnouncementModal type definition
declare global {
  interface Window {
    openAnnouncementModal?: () => void
  }
}