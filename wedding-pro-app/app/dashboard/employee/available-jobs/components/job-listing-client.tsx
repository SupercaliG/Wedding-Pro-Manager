"use client";

import { useState, useEffect } from "react";
import type { JobWithVenue, AvailableJob, JobRequiredRole } from "@/app/actions/jobs/types";
import { JobFilters, JobFilters as JobFiltersType } from "./job-filters";
import { JobList } from "./job-list";

interface JobListingClientProps {
  initialJobs: AvailableJob[];
  employeeAssignments: Array<{
    id: string;
    job_id: string;
    start_time: string;
    end_time: string;
  }>;
  availableRoles: string[];
  employeeAddress?: string;
  orgAddress?: string;
}

export function JobListingClient({
  initialJobs,
  employeeAssignments,
  availableRoles,
  employeeAddress,
  orgAddress
}: JobListingClientProps) {
  const [jobs, setJobs] = useState<AvailableJob[]>(initialJobs);
  const [filters, setFilters] = useState<JobFiltersType>({
    role: "",
    distance: "",
    status: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  // Handle filter changes
  const handleFilterChange = async (newFilters: JobFiltersType) => {
    setFilters(newFilters);
    setIsLoading(true);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (newFilters.role) params.append("role", newFilters.role);
      if (newFilters.distance) params.append("distance", newFilters.distance);
      if (newFilters.status) params.append("status", newFilters.status);
      
      // Fetch filtered jobs
      const response = await fetch(`/api/employee/jobs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch filtered jobs");
      }
      
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Error fetching filtered jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply client-side filtering for immediate feedback
  // This is a fallback until the API request completes
  useEffect(() => {
    const applyClientFilters = () => {
      let filtered = [...initialJobs];
      
      // Apply role filter
      if (filters.role) {
        filtered = filtered.filter(job =>
          job.job_required_roles?.some((role: JobRequiredRole) => role.role_name === filters.role)
        );
      }
      
      // Apply status filter
      if (filters.status) {
        filtered = filtered.filter(job => job.status === filters.status);
      }
      
      // Note: Distance filtering requires API call, so we don't do it client-side
      
      setJobs(filtered);
    };
    
    applyClientFilters();
  }, [filters.role, filters.status, initialJobs]);

  return (
    <>
      <JobFilters
        availableRoles={availableRoles}
        onFilterChange={handleFilterChange}
        initialFilters={filters}
      />
      
      <div className="bg-white rounded-lg shadow p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-gray-600">No available jobs match your criteria.</p>
        ) : (
          <JobList
            jobs={jobs}
            employeeAssignments={employeeAssignments}
            employeeAddress={employeeAddress}
            orgAddress={orgAddress}
          />
        )}
      </div>
    </>
  );
}