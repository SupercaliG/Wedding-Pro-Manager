import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isAdmin } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import HoneyBookIntegration from "./components/honeybook-integration";
import { FEATURES } from "@/utils/feature-flags";

export default async function OrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is admin
  const hasAccess = await isAdmin();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get current user profile
  const profile = await getCurrentUserProfile();
  if (!profile?.org_id) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Organization</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          You are not associated with any organization.
        </div>
      </div>
    );
  }
  
  // Get organization details
  const { data: org, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('id', profile.org_id)
    .single();
  
  if (error || !org) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Organization</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading organization: {error?.message || "Organization not found"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Organization</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{org.name}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 text-sm mb-1">Contact Email</p>
            <p className="font-medium">{org.contact_email || "Not set"}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Contact Phone</p>
            <p className="font-medium">{org.contact_phone || "Not set"}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Address</p>
            <p className="font-medium">{org.address || "Not set"}</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Travel Pay Rate</p>
            <p className="font-medium">${org.travel_pay_rate || "0.00"} per mile</p>
          </div>
          
          <div>
            <p className="text-gray-600 text-sm mb-1">Created</p>
            <p className="font-medium">{new Date(org.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <a 
            href="/dashboard/organization/edit" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Edit Organization
          </a>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Organization Settings</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Invitation Codes</h3>
            <p className="text-gray-600 mb-2">
              Share this code with employees to join your organization:
            </p>
            <div className="bg-gray-100 p-3 rounded flex justify-between items-center">
              <code className="text-blue-600 font-mono">{org.id}</code>
              <button
                className="text-gray-500 hover:text-gray-700"
                title="Copy to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(org.id);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Note: In a production system, you would generate and manage secure invitation codes.
            </p>
          </div>
          
          {/* HoneyBook Integration Section - conditionally rendered based on feature flag */}
          {FEATURES.SHOW_HONEYBOOK_INTEGRATION && <HoneyBookIntegration />}
        </div>
      </div>
    </div>
  );
}