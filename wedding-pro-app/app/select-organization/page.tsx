"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserMemberships, UserMembershipDetails, UserMembershipsResponse } from "@/app/actions/user-management"; // Barrel file import
import { setActiveOrganizationAndRedirect } from "@/app/actions/user-management"; // Barrel file import

// Interface moved to organization-actions.ts, but can keep a local one if preferred or re-import UserMembershipDetails
// For clarity, let's use UserMembershipDetails if it's exported, otherwise define locally.
// Assuming UserMembershipDetails is exported from organization-actions.ts

function SelectOrganizationContent() {
  const searchParams = useSearchParams();
  const [memberships, setMemberships] = useState<UserMembershipDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Store ID of submitting org

  const redirectTo = searchParams.get("redirectTo");
  const initialError = searchParams.get("error");

  useEffect(() => {
    if (initialError) {
      setError(decodeURIComponent(initialError));
    }
    const fetchMemberships = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response: UserMembershipsResponse = await getUserMemberships();
        
        if (response.error) {
          setError(response.error);
        } else if (response.memberships.length === 0) {
          setError("No organization memberships found for your account.");
        } else if (response.memberships.length === 1) {
          // If only one org, automatically select it and redirect
          await handleSelectOrganization(response.memberships[0].organization_id);
        } else {
          setMemberships(response.memberships);
        }
      } catch (e) {
        // This catch is for unexpected errors during the await getUserMemberships() call itself,
        // not for logical errors returned in response.error
        console.error("Exception while fetching memberships:", e);
        setError("Failed to load your organizations. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberships();
  }, [initialError]);

  const handleSelectOrganization = async (organizationId: string) => {
    setIsSubmitting(organizationId);
    setError(null);
    try {
      // setActiveOrganizationAndRedirect handles the redirect internally
      await setActiveOrganizationAndRedirect(organizationId, redirectTo || undefined);
      // If the server action doesn't redirect on error, router.push won't be reached for success.
      // If it *does* error and *doesn't* redirect, we might want to show an error here.
      // For now, assume server action handles all redirection.
    } catch (e) {
      console.error("Failed to set active organization:", e);
      setError("Failed to switch organization. Please try again.");
      setIsSubmitting(null);
    }
    // Do not set isSubmitting to null here if redirect is expected,
    // as the component might unmount.
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading organizations...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>
            You are a member of multiple organizations. Please choose which one you'd like to use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {memberships.map((membership) => (
            <Button
              key={membership.organization_id}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3"
              onClick={() => handleSelectOrganization(membership.organization_id)}
              disabled={!!isSubmitting}
            >
              {isSubmitting === membership.organization_id ? "Selecting..." : membership.name}
            </Button>
          ))}
          {memberships.length === 0 && !error && !isLoading && (
             <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No organizations found. If you believe this is an error, please contact support.
             </p>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can switch organizations later from your profile settings.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function SelectOrganizationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <SelectOrganizationContent />
    </Suspense>
  );
}