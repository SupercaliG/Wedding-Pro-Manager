'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAnnouncements } from '@/contexts/announcement-context'

/**
 * This component handles the display of announcements immediately after login.
 * It's designed to be placed on the protected page that users are redirected to
 * after successful authentication.
 */
export default function PostLoginAnnouncementHandler() {
  const router = useRouter()
  const { announcements, hasUnseenAnnouncements, refreshAnnouncements } = useAnnouncements()

  useEffect(() => {
    // Check for announcements and redirect to dashboard
    async function checkAnnouncementsAndRedirect() {
      try {
        // Refresh announcements to get the latest data
        await refreshAnnouncements()
        
        // If there are unseen announcements, set the flag in sessionStorage
        // This will be used by the dashboard to know it should show the modal
        if (hasUnseenAnnouncements && announcements.length > 0) {
          sessionStorage.setItem('hasUnseenAnnouncements', 'true')
        }
      } catch (error) {
        console.error('Error checking announcements:', error)
      } finally {
        // Redirect to dashboard regardless of announcement status
        router.push('/dashboard')
      }
    }

    checkAnnouncementsAndRedirect()
  }, [router, refreshAnnouncements, hasUnseenAnnouncements, announcements])

  // This component doesn't render anything visible
  return null
}