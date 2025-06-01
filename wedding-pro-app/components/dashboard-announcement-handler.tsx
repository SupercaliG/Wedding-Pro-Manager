'use client'

import { useEffect } from 'react'

export default function DashboardAnnouncementHandler() {
  useEffect(() => {
    const hasUnseenAnnouncements = sessionStorage.getItem('hasUnseenAnnouncements') === 'true'
    
    if (hasUnseenAnnouncements) {
      // Clear the flag immediately to prevent duplicate shows
      sessionStorage.removeItem('hasUnseenAnnouncements')
      
      // Open the modal after a short delay to ensure hydration is complete
      setTimeout(() => {
        if (window.openAnnouncementModal) {
          window.openAnnouncementModal()
        }
      }, 500)
    }
  }, [])

  return null
}