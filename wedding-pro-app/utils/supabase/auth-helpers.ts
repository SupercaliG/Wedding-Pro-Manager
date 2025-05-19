import { createClient } from './server';

export type UserProfile = {
  id: string;
  org_id: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  role: 'Admin' | 'Manager' | 'Employee';
  full_name: string | null;
  phone_number: string | null;
};

/**
 * Get the current user's profile including org_id and approval_status
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, org_id, approval_status, role, full_name, phone_number')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;

  return data as UserProfile;
}

/**
 * Check if the current user is approved
 */
export async function isUserApproved(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.approval_status === 'approved';
}

/**
 * Check if the current user belongs to a specific organization
 * This is a placeholder that will be enhanced in Task 3 when orgs table is created
 */
export async function isUserInOrg(orgId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.org_id === orgId;
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.role === role && profile?.approval_status === 'approved';
}

/**
 * Check if the current user has any of the specified roles
 */
export async function hasAnyRole(roles: string[]): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.approval_status === 'approved' && roles.includes(profile?.role);
}

/**
 * Check if the current user is an Admin
 */
export async function isAdmin(): Promise<boolean> {
  return await hasRole('Admin');
}

/**
 * Check if the current user is a Manager
 */
export async function isManager(): Promise<boolean> {
  return await hasRole('Manager');
}

/**
 * Check if the current user is an Employee
 */
export async function isEmployee(): Promise<boolean> {
  return await hasRole('Employee');
}

/**
 * Check if the current user is an Admin or Manager
 */
export async function isAdminOrManager(): Promise<boolean> {
  return await hasAnyRole(['Admin', 'Manager']);
}