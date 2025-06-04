"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext, isValidElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.ReactElement | React.ReactNode;
}

// Simplified context, primarily for mobile state if needed, or can be removed if MobileSidebar manages its own state.
// For now, let's keep a minimal context in case other child components might need to know about mobile's open state.
interface SidebarContextProps {
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

// The main Sidebar component now just wraps with the provider.
// Props like open, setOpen, isPinned, setIsPinned, animate are removed.
export const Sidebar = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <SidebarProvider>
      {children}
    </SidebarProvider>
  );
};

// SidebarBody props might change if motion.div is no longer needed for DesktopSidebar
export const SidebarBody = (props: React.ComponentProps<"div">) => { // Changed from motion.div
  const { children, className, ...restProps } = props;
  return (
    <>
      {/* Pass down children to DesktopSidebar. className and restProps might be for the wrapper if any, or directly to DesktopSidebar */}
      <DesktopSidebar className={className} {...restProps}>{children}</DesktopSidebar>
      <MobileSidebar className={className} {...restProps}>{children}</MobileSidebar>
    </>
  );
};

// DesktopSidebarProps no longer needs to extend MotionProps if motion.div is removed.
interface DesktopSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: DesktopSidebarProps) => {
  // No longer uses useSidebar for open, setOpen, isPinned, setIsPinned, animate

  return (
    <div // Changed from motion.div
      className={cn(
        "h-screen px-4 py-4 hidden md:flex md:flex-col bg-slate-100 text-slate-700 w-[260px] flex-shrink-0 relative", // Fixed width, h-screen for full height
        className
      )}
      // Removed animate prop
      // Removed onMouseEnter, onMouseLeave
      {...props}
    >
      {/* Pin button removed */}
      {children}
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  // MobileSidebar now manages its own open state or uses a simplified context
  const { mobileOpen, setMobileOpen } = useSidebar(); // Or manage state locally: const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-slate-100 w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-slate-700 cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
          />
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-slate-50 p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-slate-700 cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props // Spread remaining props to Link
}: {
  link: Links;
  className?: string;
  props?: LinkProps; // This was likely intended for the Link component itself
}) => {
  // const { open, animate, isPinned } = useSidebar(); // No longer needed for desktop link label visibility

  const iconElement = isValidElement<{ className?: string }>(link.icon)
    ? React.cloneElement(link.icon, {
        className: cn(
          link.icon.props.className,
          "text-slate-600 group-hover/sidebar:text-slate-800"
        ),
      })
    : link.icon;

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2 text-slate-700 hover:text-slate-900",
        className
      )}
      {...props} // Apply passed LinkProps here
    >
      {iconElement}
      {/* motion.span can become a regular span or motion can be removed if no animation is desired */}
      <span // Changed from motion.span, animations removed
        // animate={{
        //   display: animate ? (open || isPinned ? "inline-block" : "none") : "inline-block",
        //   opacity: animate ? (open || isPinned ? 1 : 0) : 1,
        // }}
        className="text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </span>
    </Link>
  );
};