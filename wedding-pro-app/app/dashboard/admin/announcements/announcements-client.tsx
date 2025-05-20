'use client'

import { useState, useEffect } from 'react'
import { 
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement,
  getOrganizationAnnouncements
} from '@/app/announcement-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Pin, Trash2, Edit, Plus, BarChart3 } from 'lucide-react'

type Announcement = {
  id: string
  title: string
  content: string
  is_active: boolean
  pinned_until: string | null
  created_at: string
  updated_at: string
}

type AnnouncementAnalytics = {
  announcement_id: string
  title: string
  view_count: number
  dismiss_count: number
  click_count: number
  click_through_rate: number
}

type AnnouncementManagementProps = {
  orgId: string
  userRole: string
  initialAnalytics: AnnouncementAnalytics[]
}

export default function AnnouncementManagement({ 
  orgId, 
  userRole,
  initialAnalytics
}: AnnouncementManagementProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [analytics, setAnalytics] = useState<AnnouncementAnalytics[]>(initialAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('announcements')
  
  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formIsPinned, setFormIsPinned] = useState(false)
  const [formPinnedDays, setFormPinnedDays] = useState(7)
  
  // Load announcements
  useEffect(() => {
    async function loadAnnouncements() {
      try {
        setLoading(true)
        const data = await getOrganizationAnnouncements({ onlyActive: false })
        setAnnouncements(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load announcements')
        console.error('Error loading announcements:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAnnouncements()
  }, [])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isDialogOpen && editingAnnouncement) {
      setFormTitle(editingAnnouncement.title)
      setFormContent(editingAnnouncement.content)
      setFormIsActive(editingAnnouncement.is_active)
      
      const isPinned = !!editingAnnouncement.pinned_until &&
        new Date(editingAnnouncement.pinned_until) > new Date()
      
      setFormIsPinned(isPinned)
      
      if (isPinned && editingAnnouncement.pinned_until) {
        const daysRemaining = Math.ceil(
          (new Date(editingAnnouncement.pinned_until).getTime() - new Date().getTime()) / 
          (1000 * 60 * 60 * 24)
        )
        setFormPinnedDays(daysRemaining > 0 ? daysRemaining : 7)
      } else {
        setFormPinnedDays(7)
      }
    } else if (isDialogOpen) {
      // New announcement
      setFormTitle('')
      setFormContent('')
      setFormIsActive(true)
      setFormIsPinned(false)
      setFormPinnedDays(7)
    }
  }, [isDialogOpen, editingAnnouncement])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const pinnedUntil = formIsPinned 
        ? new Date(Date.now() + formPinnedDays * 24 * 60 * 60 * 1000) 
        : null
      
      if (editingAnnouncement) {
        // Update existing announcement
        await updateAnnouncement({
          id: editingAnnouncement.id,
          title: formTitle,
          content: formContent,
          isActive: formIsActive,
          pinnedUntil
        })
        
        // Update local state
        setAnnouncements(prev => prev.map(a => 
          a.id === editingAnnouncement.id 
            ? { 
                ...a, 
                title: formTitle, 
                content: formContent, 
                is_active: formIsActive,
                pinned_until: pinnedUntil?.toISOString() || null
              } 
            : a
        ))
      } else {
        // Create new announcement
        const newAnnouncement = await createAnnouncement({
          orgId,
          title: formTitle,
          content: formContent,
          isActive: formIsActive,
          pinnedUntil
        })
        
        // Update local state
        setAnnouncements(prev => [newAnnouncement, ...prev])
      }
      
      // Close dialog
      setIsDialogOpen(false)
      setEditingAnnouncement(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save announcement')
      console.error('Error saving announcement:', err)
    }
  }

  // Handle announcement deletion
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }
    
    try {
      await deleteAnnouncement(id)
      
      // Update local state
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement')
      console.error('Error deleting announcement:', err)
    }
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

  // Get analytics for an announcement
  const getAnnouncementAnalytics = (id: string) => {
    return analytics.find(a => a.announcement_id === id) || {
      view_count: 0,
      dismiss_count: 0,
      click_count: 0,
      click_through_rate: 0
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading announcements...</div>
  }

  return (
    <div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <Button onClick={() => {
            setEditingAnnouncement(null)
            setIsDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>
        
        <TabsContent value="announcements" className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No announcements yet. Create your first announcement to get started.
            </div>
          ) : (
            <div className="grid gap-4">
              {announcements.map(announcement => (
                <div 
                  key={announcement.id} 
                  className={`border rounded-lg p-4 ${!announcement.is_active ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg flex items-center gap-2">
                        {announcement.title}
                        {isPinned(announcement) && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                            <Pin className="h-3 w-3 mr-1" />
                            Pinned
                          </Badge>
                        )}
                        {!announcement.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
                            Inactive
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Created: {formatDate(announcement.created_at)}
                      </p>
                      {isPinned(announcement) && announcement.pinned_until && (
                        <p className="text-sm text-amber-600 mt-1">
                          Pinned until: {formatDate(announcement.pinned_until)}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditingAnnouncement(announcement)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                    {announcement.content}
                  </div>
                  
                  <div className="mt-4 flex gap-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="font-medium mr-1">{getAnnouncementAnalytics(announcement.id).view_count}</span> views
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium mr-1">{getAnnouncementAnalytics(announcement.id).click_count}</span> clicks
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium mr-1">{getAnnouncementAnalytics(announcement.id).click_through_rate}%</span> CTR
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="analytics">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Announcement Analytics
            </h2>
            
            {analytics.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No analytics data available yet. Analytics will appear once users interact with announcements.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Announcement
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clicks
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dismissals
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CTR
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.map((item) => (
                      <tr key={item.announcement_id}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.title}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.view_count}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.click_count}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.dismiss_count}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.click_through_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Announcement Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Announcement title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Announcement content"
                className="w-full min-h-[120px] px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is-pinned"
                checked={formIsPinned}
                onCheckedChange={setFormIsPinned}
              />
              <Label htmlFor="is-pinned">Pin Announcement</Label>
            </div>
            
            {formIsPinned && (
              <div className="space-y-2">
                <Label htmlFor="pinned-days">Pin for how many days?</Label>
                <Input
                  id="pinned-days"
                  type="number"
                  min="1"
                  max="90"
                  value={formPinnedDays}
                  onChange={(e) => setFormPinnedDays(parseInt(e.target.value) || 7)}
                />
              </div>
            )}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAnnouncement ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}