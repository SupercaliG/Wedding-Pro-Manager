'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Pin, ExternalLink } from 'lucide-react'
import {
  trackAnnouncementEngagement,
  getRecentEngagements
} from '@/app/announcement-actions'
import { useAnnouncements } from '@/contexts/announcement-context'

type Announcement = {
  id: string
  title: string
  content: string
  is_active: boolean
  pinned_until: string | null
  created_at: string
}

export default function AnnouncementModal() {
  const [open, setOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Use the announcement context
  const {
    announcements,
    loading,
    error,
    refreshAnnouncements
  } = useAnnouncements()

  const currentAnnouncement = announcements[currentIndex]
  const hasMultipleAnnouncements = announcements.length > 1

  // Tracking state
  const [trackingInProgress, setTrackingInProgress] = useState(false)
  const trackingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 3
  
  // Debounced tracking function
  const debouncedTrackEngagement = useCallback(async (
    announcementId: string,
    engagementType: 'view' | 'dismiss' | 'click',
    metadata = {},
    retryCount = 0
  ) => {
    if (retryCount > maxRetries) {
      console.error(`Failed to track ${engagementType} after ${maxRetries} retries`)
      return
    }
    
    setTrackingInProgress(true)
    
    try {
      await trackAnnouncementEngagement({
        announcementId,
        engagementType,
        metadata,
        deduplicate: true,
        deduplicationWindow: engagementType === 'view' ? 300 : 60 // 5 minutes for views, 1 minute for others
      })
      retryCountRef.current = 0
    } catch (err) {
      console.error(`Error tracking ${engagementType}:`, err)
      
      // Retry with exponential backoff
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000) // Max 10 seconds
      
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current)
      }
      
      trackingTimeoutRef.current = setTimeout(() => {
        debouncedTrackEngagement(announcementId, engagementType, metadata, retryCount + 1)
      }, backoffTime)
    } finally {
      setTrackingInProgress(false)
    }
  }, [])
  
  // Reset current index when announcements change
  useEffect(() => {
    setCurrentIndex(0)
  }, [announcements])
  
  // Clean up any pending tracking timeouts
  useEffect(() => {
    return () => {
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current)
      }
    }
  }, [])

  // Consolidated view tracking
  useEffect(() => {
    // Only track views when the modal is open and we have an announcement to show
    if (open && currentAnnouncement) {
      const viewMetadata = {
        announcement_index: currentIndex,
        total_announcements: announcements.length,
        announcement_title: currentAnnouncement.title,
        is_pinned: currentAnnouncement.pinned_until ?
          new Date(currentAnnouncement.pinned_until) > new Date() : false
      }
      
      debouncedTrackEngagement(currentAnnouncement.id, 'view', viewMetadata)
    }
  }, [open, currentAnnouncement, currentIndex, announcements.length, debouncedTrackEngagement])

  // Handle modal close
  const handleClose = () => {
    if (currentAnnouncement) {
      const dismissMetadata = {
        announcement_index: currentIndex,
        total_announcements: announcements.length,
        announcement_title: currentAnnouncement.title,
        dismiss_source: 'close_button'
      }
      
      debouncedTrackEngagement(currentAnnouncement.id, 'dismiss', dismissMetadata)
    }
    setOpen(false)
  }

  // Handle link click
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (currentAnnouncement) {
      const clickMetadata = {
        url: e.currentTarget.href,
        element_type: 'link',
        element_text: e.currentTarget.textContent,
        announcement_index: currentIndex,
        total_announcements: announcements.length,
        announcement_title: currentAnnouncement.title
      }
      
      debouncedTrackEngagement(currentAnnouncement.id, 'click', clickMetadata)
    }
  }
  
  // Handle button click tracking
  const handleButtonClick = (buttonType: string, action: () => void) => {
    if (currentAnnouncement) {
      const clickMetadata = {
        element_type: 'button',
        button_type: buttonType,
        announcement_index: currentIndex,
        total_announcements: announcements.length,
        announcement_title: currentAnnouncement.title
      }
      
      debouncedTrackEngagement(currentAnnouncement.id, 'click', clickMetadata)
    }
    
    // Execute the original action
    action()
  }

  // Navigate to next announcement
  const handleNext = () => {
    const action = () => {
      if (currentIndex < announcements.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setOpen(false)
      }
    }
    
    handleButtonClick('next', action)
  }

  // Navigate to previous announcement
  const handlePrevious = () => {
    const action = () => {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
      }
    }
    
    handleButtonClick('previous', action)
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Check if announcement is pinned
  const isPinned = (announcement: Announcement) => {
    if (!announcement.pinned_until) return false
    return new Date(announcement.pinned_until) > new Date()
  }

  // Open the modal programmatically (can be called from other components)
  const openAnnouncementModal = () => {
    if (announcements.length > 0) {
      setCurrentIndex(0)
      setOpen(true)
    }
  }

  // Expose the open method to window for external access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.openAnnouncementModal = openAnnouncementModal
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.openAnnouncementModal
      }
    }
  }, [announcements])

  // After closing the modal, refresh announcements to get the latest view status
  const handleModalClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Refresh announcements after a short delay to allow tracking to complete
      setTimeout(() => {
        refreshAnnouncements()
      }, 500)
    }
  }

  if (loading || !currentAnnouncement) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle>{currentAnnouncement.title}</DialogTitle>
            {isPinned(currentAnnouncement) && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            data-tracking-id="close-button"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="mt-2 text-sm text-gray-500">
          Posted on {formatDate(currentAnnouncement.created_at)}
        </div>
        
        <div className="mt-4 prose prose-sm max-w-none">
          {/* Replace URLs with clickable links */}
          {currentAnnouncement.content.split(/\s+/).map((word, i) => {
            if (word.match(/^(https?:\/\/)/i)) {
              return (
                <a
                  key={i}
                  href={word}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="text-blue-600 hover:underline inline-flex items-center"
                  data-tracking-id="content-link"
                >
                  {word}
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </a>
              )
            }
            return <span key={i}>{word} </span>
          })}
        </div>
        
        {hasMultipleAnnouncements && (
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              data-tracking-id="previous-button"
            >
              Previous
            </Button>
            <div className="text-sm text-gray-500 self-center">
              {currentIndex + 1} of {announcements.length}
            </div>
            <Button
              variant="default"
              onClick={handleNext}
              data-tracking-id="next-button"
            >
              {currentIndex === announcements.length - 1 ? 'Close' : 'Next'}
            </Button>
          </div>
        )}
        
        {!hasMultipleAnnouncements && (
          <div className="flex justify-end mt-6">
            <Button
              variant="default"
              onClick={handleClose}
              data-tracking-id="single-close-button"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}