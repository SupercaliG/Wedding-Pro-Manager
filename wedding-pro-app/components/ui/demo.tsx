"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LayoutDashboard, UserCog, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js"; // Assuming User type is available

interface NavLink {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  section?: string; // For section headers
  roles?: string[]; // To control visibility based on user role
}

interface GlobalDashboardLayoutProps {
  children: React.ReactNode;
  userProfile: {
    role?: string | null;
    // Add other profile fields if needed, e.g., avatar_url, full_name
    avatar_url?: string | null;
    full_name?: string | null;
  } | null;
  navLinks: NavLink[];
}

export default function GlobalDashboardLayout({
  children,
  userProfile,
  navLinks,
}: GlobalDashboardLayoutProps) {
  const [open, setOpen] = useState(false); // This controls the open state for the Sidebar component instance
  // To use animate from context for the sign out button, we'd typically call useSidebar here.
  // However, GlobalDashboardLayout IS the direct parent providing Sidebar, which then provides context.
  // The 'animate={true}' is passed to Sidebar. So, within SidebarLink (used for nav items), useSidebar().animate works.
  // For the custom sign-out button, we need to ensure it behaves consistently.
  // The 'animate' prop for the Sidebar component itself is set to true below.
  // Let's assume 'animate' should behave as if it's true for the sign out button's text visibility.
  // The TS error is because 'animate' is not in the local scope of the return statement for the sign out button.
  // We can pass the 'animate' prop explicitly or retrieve it if GlobalDashboardLayout itself were a child of SidebarProvider.
  // Since GlobalDashboardLayout *contains* the SidebarProvider (via the Sidebar component),
  // the most straightforward way is to use the 'animate' value that's passed to the Sidebar component.
  // The 'animate' prop of the <Sidebar> component is hardcoded to `true` on line 96.
  // So, for the sign-out button's motion.span, we can use this known value.

  const userAvatar = userProfile?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop";
  const userName = userProfile?.full_name || "User";

  // Filter links based on user role
  const accessibleLinks = navLinks.filter(link => {
    if (!link.roles || link.roles.length === 0) return true; // No role restriction
    if (!userProfile || !userProfile.role) return false; // No user role to check against
    return link.roles.includes(userProfile.role);
  });

  // Group links by section for rendering headers
  const groupedLinks: { [key: string]: NavLink[] } = accessibleLinks.reduce((acc, link) => {
    const section = link.section || "General";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(link);
    return acc;
  }, {} as { [key: string]: NavLink[] });


  const defaultLinks = [ // Fallback if navLinks is empty, or for sections not covered
    {
      label: "Dashboard",
      href: "#",
      icon: (
        <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Profile",
      href: "#",
      icon: (
        <UserCog className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Settings",
      href: "#",
      icon: (
        <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Logout",
      href: "#",
      icon: (
        <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1",
        "h-screen" // Use h-screen for full height
      )}
    >
      <Sidebar open={open} setOpen={setOpen} animate={true}> {/* Ensure animate is true or passed as prop */}
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {Object.entries(groupedLinks).map(([section, linksInSection]) => (
                <React.Fragment key={section}>
                  {section !== "General" && ( // Don't show header for "General" or if it's the only section
                    <div className="pt-2 pb-1 text-xs uppercase text-neutral-500 dark:text-neutral-400 font-semibold px-1">
                       {open || !true ? section : ""} {/* Show section only if sidebar is open or animation is off */}
                    </div>
                  )}
                  {linksInSection.map((link, idx) => (
                    <SidebarLink key={`${section}-${idx}`} link={link} />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: userName,
                href: "/dashboard/profile", // Link to profile page
                icon: (
                  <Image
                    src={userAvatar}
                    className="h-7 w-7 flex-shrink-0 rounded-full"
                    width={50}
                    height={50}
                    alt="User Avatar"
                  />
                ),
              }}
            />
            {/* Sign Out Form */}
            <form action="/app/actions" method="post" className="w-full mt-1"> {/* Added mt-1 for a little space */}
              <input type="hidden" name="action" value="signOut" />
              <button
                type="submit"
                className={cn(
                  "flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md",
                  // Match SidebarLink padding if open or not for alignment
                  open ? "px-[10px]" : "px-[10px]" // Adjust px if icon size/gap changes in SidebarLink
                )}
              >
                <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                <motion.span
                  animate={{
                    // Use the 'true' value passed to Sidebar's animate prop, or manage a separate animate state/prop if it needs to be dynamic here
                    display: true ? (open ? "inline-block" : "none") : "inline-block",
                    opacity: true ? (open ? 1 : 0) : 1,
                  }}
                  className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                >
                  Sign Out
                </motion.span>
              </button>
            </form>
          </div>
        </SidebarBody>
      </Sidebar>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Optional Header for main content can go here */}
        {/* <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Page Title</h1>
        </div> */}
        <main className="p-2 md:p-6 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        WeddingPro
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};

// Dummy dashboard component with content - This is no longer needed here as children will be passed
// const Dashboard = () => {
//   return (
//     <div className="flex flex-1">
//       <div className="p-2 md:p-10 rounded-tl-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full">
//         <div className="flex gap-2">
//           {[...new Array(4)].map((_, i) => (
//             <div
//               key={"first-array" + i}
//               className="h-20 w-full rounded-lg  bg-gray-100 dark:bg-neutral-800 animate-pulse"
//             ></div>
//           ))}
//         </div>
//         <div className="flex gap-2 flex-1">
//           {[...new Array(2)].map((_, i) => (
//             <div
//               key={"second-array" + i}
//               className="h-full w-full rounded-lg  bg-gray-100 dark:bg-neutral-800 animate-pulse"
//             ></div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };