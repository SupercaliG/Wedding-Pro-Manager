import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Get current user profile
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Profile not found. Please contact support.
        </div>
      </div>
    );
  }
  
  // Get organization details if user is part of an organization
  let org = null;
  if (profile.org_id) {
    const { data: orgData } = await supabase
      .from('orgs')
      .select('name')
      .eq('id', profile.org_id)
      .single();
    
    org = orgData;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 text-sm mb-1">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Full Name</p>
            <p className="font-medium">{profile.full_name || "Not set"}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Phone Number</p>
            <p className="font-medium">{profile.phone_number || "Not set"}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Role</p>
            <p className="font-medium">{profile.role}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Status</p>
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              profile.approval_status === 'approved' 
                ? 'bg-green-100 text-green-800' 
                : profile.approval_status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {profile.approval_status}
            </span>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Organization</p>
            <p className="font-medium">{org?.name || "None"}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <a 
            href="/dashboard/profile/edit" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Edit Profile
          </a>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Security</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Password</h3>
            <p className="text-gray-600 mb-4">
              Change your password to keep your account secure.
            </p>
            <a 
              href="/protected/reset-password" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Change Password
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
        <p className="text-gray-600 mb-6">
          Manage how you receive notifications from Wedding Pro.
        </p>
        
        <NotificationPreferences />
      </div>
    </div>
  );
}