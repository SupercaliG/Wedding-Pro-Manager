import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link"; // Keep for potential direct use if any, though sidebar handles most
import DashboardAnnouncementHandler from "@/components/dashboard-announcement-handler";
import { isUserApproved, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import { NotificationCenterWrapper } from "@/components/notifications/notification-center-wrapper";
import AnnouncementModal from "@/components/announcement-modal";
import { AnnouncementProvider } from "@/contexts/announcement-context";
import GlobalDashboardLayout from "@/components/ui/demo"; // Renamed from SidebarDemo
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserCheck,
  Settings,
  ShieldCheck,
  FileText,
  Briefcase,
  Building,
  LogOut,
  Bell,
  CalendarDays,
  ClipboardList,
  Newspaper, // For Announcements
  Archive // For System Logs
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user is approved
  const isApproved = await isUserApproved();
  if (!isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center mb-4">Account Pending Approval</h1>
          <p className="text-gray-600 mb-4">
            Your account is currently pending approval by an administrator. 
            You'll receive an email once your account has been approved.
          </p>
          <div className="flex justify-center">
            <form action="/actions" method="post">
              <input type="hidden" name="action" value="signOut" />
              <button
                type="submit"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Get user profile to determine role
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === 'Admin';
  const isManager = profile?.role === 'Manager';

  const commonLinks = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
      section: "General",
      roles: ["Admin", "Manager", "Employee"]
    },
  ];

  const adminLinks = [
    { section: "Admin", label: "User Management", href: "/dashboard/users", icon: <Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Invite Users", href: "/dashboard/invite", icon: <UserPlus className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Account Approvals", href: "/dashboard/admin/account-approvals", icon: <UserCheck className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Organization Settings", href: "/dashboard/organization", icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Subscription", href: "/dashboard/admin/subscription", icon: <ShieldCheck className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "System Logs", href: "/dashboard/admin/audit-logs", icon: <Archive className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Drop Requests", href: "/dashboard/admin/drop-requests", icon: <Briefcase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
    { section: "Admin", label: "Announcements", href: "/dashboard/admin/announcements", icon: <Newspaper className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Admin"] },
  ];

  const managerLinks = [
    { section: "Management", label: "Team Members", href: "/dashboard/users", icon: <Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    { section: "Management", label: "Invite Employees", href: "/dashboard/invite", icon: <UserPlus className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    { section: "Management", label: "Account Approvals", href: "/dashboard/manager/account-approvals", icon: <UserCheck className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    { section: "Management", label: "Job Management", href: "/dashboard/manager/jobs", icon: <Briefcase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    // { section: "Management", label: "Team Overview", href: "/dashboard/manager/team", icon: <Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] }, // Assuming /team is similar to /users for now
    { section: "Management", label: "Venue Management", href: "/dashboard/manager/venues", icon: <Building className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    { section: "Management", label: "Drop Requests", href: "/dashboard/manager/drop-requests", icon: <Briefcase className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] },
    { section: "Management", label: "Announcements", href: "/dashboard/admin/announcements", icon: <Newspaper className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Manager"] }, // Managers can also access announcements
  ];

  const employeeLinks = [
    { section: "My Work", label: "My Schedule", href: "/dashboard/employee/schedule", icon: <CalendarDays className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Employee"] },
    { section: "My Work", label: "Available Jobs", href: "/dashboard/employee/available-jobs", icon: <ClipboardList className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Employee"] },
    { section: "My Work", label: "Notifications", href: "/dashboard/notifications", icon: <Bell className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, roles: ["Employee"] }, // Changed from /employee/notifications
  ];
  
  const accountLinks = [
     {
      label: "My Profile",
      href: "/dashboard/profile",
      icon: <UserCheck className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, // Changed icon
      section: "Account",
      roles: ["Admin", "Manager", "Employee"]
    },
    // Sign out is handled by the GlobalDashboardLayout component itself
  ];

  let navLinks = [...commonLinks];
  if (isAdmin) {
    navLinks = [...navLinks, ...adminLinks];
  }
  if (isManager) {
    // Avoid duplicating links if user is both Admin and Manager, though PRD implies distinct roles.
    // For now, let's assume Admin role encompasses Manager links if needed, or they are separate.
    // If a user can be Admin AND Manager, link duplication might occur if not handled.
    // The current GlobalDashboardLayout filters by role, so it should be fine.
    navLinks = [...navLinks, ...managerLinks];
  }
  if (profile?.role === 'Employee') {
    navLinks = [...navLinks, ...employeeLinks];
  }
  navLinks = [...navLinks, ...accountLinks];


  // The signOut action needs to be available to the GlobalDashboardLayout's sign out button.
  // This might require passing the action path or a client-side handler.
  // For now, the GlobalDashboardLayout has a placeholder.

  return (
    <AnnouncementProvider>
      <DashboardAnnouncementHandler />
      <GlobalDashboardLayout userProfile={profile} navLinks={navLinks}>
        {/* Header with notification center - can be part of GlobalDashboardLayout or kept here if specific to this section */}
        <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 px-6 py-3 flex justify-between items-center sticky top-0 z-50">
          {/* Hamburger for mobile can be added here if GlobalDashboardLayout doesn't handle it for main content area */}
          <h1 className="text-lg font-semibold">
            {/* TODO: Make this title dynamic based on the current page */}
            Wedding Pro
          </h1>
          <div className="flex items-center space-x-4">
            <NotificationCenterWrapper />
            {/* Theme switcher can be added here */}
          </div>
        </div>
        
        {/* Page content */}
        <div className="p-4 sm:p-6 md:p-8"> {/* Adjusted padding */}
          {children}
        </div>
        
        {/* Announcement Modal - this should ideally be triggered/managed globally or via context if it's a modal overlay */}
        <AnnouncementModal />
      </GlobalDashboardLayout>
    </AnnouncementProvider>
  );
}