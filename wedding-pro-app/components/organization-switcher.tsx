"use client";

import React, { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons"; // Or any other suitable icons
import { getUserMemberships, UserMembershipDetails, UserMembershipsResponse } from "@/app/actions/user-management";
import { switchActiveOrganization } from "@/app/actions/user-management";
import { useRouter } from "next/navigation"; // For potential refresh or error handling

export function OrganizationSwitcher() {
  const [membershipsInfo, setMembershipsInfo] = useState<UserMembershipsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchInfo = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getUserMemberships();
        if (response.error) {
          setError(response.error);
          setMembershipsInfo(null);
        } else {
          setMembershipsInfo(response);
        }
      } catch (e) {
        console.error("Failed to fetch memberships for switcher:", e);
        setError("Failed to load organization data.");
        setMembershipsInfo(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInfo();
  }, []);

  const handleSwitchOrganization = async (newOrgId: string) => {
    if (!membershipsInfo || newOrgId === membershipsInfo.activeOrgId) {
      setIsOpen(false);
      return;
    }
    setIsLoading(true); // Indicate loading state for the switch action
    try {
      const result = await switchActiveOrganization(newOrgId);
      if (result?.error) {
        setError(result.error);
        // Potentially use toast notification for better UX
        console.error("Error switching organization:", result.error);
      } else {
        // The server action `switchActiveOrganization` handles redirect to /dashboard
        // which should trigger a page reload and data refresh.
        // If not, a router.refresh() or similar might be needed here,
        // but rely on server action's redirect first.
        // Forcing a refresh to ensure JWT and data are updated.
        router.refresh(); 
      }
    } catch (e) {
      console.error("Exception while switching organization:", e);
      setError("An unexpected error occurred while switching organizations.");
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  if (isLoading && !membershipsInfo) {
    // Initial loading state
    return <div className="text-sm text-gray-500">Loading orgs...</div>;
  }

  if (error && !membershipsInfo?.memberships.length) {
     // Show error only if there are no memberships to display, otherwise show switcher with error message below
    return <div className="text-sm text-red-500" title={error}>Error loading orgs</div>;
  }
  
  if (!membershipsInfo || membershipsInfo.memberships.length <= 1) {
    // Don't show switcher if user is in 0 or 1 org, or if data isn't loaded properly
    return null;
  }

  const activeMembership = membershipsInfo.memberships.find(
    (m) => m.organization_id === membershipsInfo.activeOrgId
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <span>{activeMembership ? activeMembership.name : "Select Org"}</span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {membershipsInfo.memberships.map((membership) => (
            <DropdownMenuItem
              key={membership.organization_id}
              onClick={() => handleSwitchOrganization(membership.organization_id)}
              disabled={isLoading || membership.organization_id === membershipsInfo.activeOrgId}
              className="flex justify-between items-center"
            >
              <span>{membership.name}</span>
              {membership.organization_id === membershipsInfo.activeOrgId && (
                <CheckIcon className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {error && (
            <div className="p-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
                Error: {error}
            </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}