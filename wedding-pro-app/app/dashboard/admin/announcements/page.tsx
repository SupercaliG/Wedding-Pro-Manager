import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AnnouncementManagement from './announcements-client'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/sign-in')
  }
  
  // Get the user's profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile) {
    redirect('/dashboard')
  }
  
  // Only allow admins and managers to access this page
  if (!profile.role || !['Admin', 'Manager'].includes(profile.role)) {
    redirect('/dashboard')
  }
  
  // Get analytics data for all announcements in the organization
  const { data: analytics, error: analyticsError } = await supabase
    .from('announcement_analytics')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
  
  if (analyticsError) {
    console.error('Error fetching analytics:', analyticsError)
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Organization Announcements</h1>
      <AnnouncementManagement 
        orgId={profile.org_id} 
        userRole={profile.role}
        initialAnalytics={analytics || []}
      />
    </div>
  )
}