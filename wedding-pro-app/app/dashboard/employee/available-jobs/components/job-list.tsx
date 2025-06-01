"use client";

import { useState, useEffect } from "react";
import type { JobWithVenue } from "@/app/actions/jobs/types";
import { JobCard } from "./job-card";
import { RoutePreviewModal } from "./route-preview-modal";
import { getUserJobInterests } from "@/app/job-interest-actions";

interface Assignment {
  id: string;
  job_id: string;
  start_time: string;
  end_time: string;
}

interface JobListProps {
  jobs: JobWithVenue[];
  employeeAssignments: Assignment[];
  employeeAddress?: string;
  orgAddress?: string;
}

export function JobList({ 
  jobs, 
  employeeAssignments, 
  employeeAddress, 
  orgAddress 
}: JobListProps) {
  const [selectedJob, setSelectedJob] = useState<JobWithVenue | null>(null);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [isLoadingInterests, setIsLoadingInterests] = useState(true);

  // Fetch user's job interests
  const fetchUserInterests = async () => {
    setIsLoadingInterests(true);
    try {
      const { data, error } = await getUserJobInterests();
      if (error) {
        console.error("Error fetching user interests:", error);
      } else {
        setUserInterests(data);
      }
    } catch (error) {
      console.error("Error fetching user interests:", error);
    } finally {
      setIsLoadingInterests(false);
    }
  };

  // Fetch interests on component mount
  useEffect(() => {
    fetchUserInterests();
  }, []);

  // Check if a job has time conflicts with existing assignments
  const hasTimeConflict = (job: JobWithVenue) => {
    if (!employeeAssignments.length) return false;
    
    const jobStart = new Date(job.start_time).getTime();
    const jobEnd = new Date(job.end_time).getTime();
    
    return employeeAssignments.some(assignment => {
      // Skip if it's the same job
      if (assignment.job_id === job.id) return false;
      
      const assignmentStart = new Date(assignment.start_time).getTime();
      const assignmentEnd = new Date(assignment.end_time).getTime();
      
      // Check for overlap
      return (
        (jobStart >= assignmentStart && jobStart < assignmentEnd) || // Job starts during assignment
        (jobEnd > assignmentStart && jobEnd <= assignmentEnd) || // Job ends during assignment
        (jobStart <= assignmentStart && jobEnd >= assignmentEnd) // Job encompasses assignment
      );
    });
  };

  const openRoutePreview = (job: JobWithVenue) => {
    setSelectedJob(job);
    setIsRouteModalOpen(true);
  };

  const closeRoutePreview = () => {
    setIsRouteModalOpen(false);
  };

  // Determine origin address for route preview
  const getOriginAddress = () => {
    // Prefer employee address if available
    if (employeeAddress) return employeeAddress;
    // Fall back to organization address
    if (orgAddress) return orgAddress;
    // Default fallback
    return "Current Location";
  };

  // Get destination address from job venue
  const getDestinationAddress = (job: JobWithVenue) => {
    if (!job.venue) return "";
    return `${job.venue.address}, ${job.venue.city}, ${job.venue.state} ${job.venue.zip}`;
  };

  return (
    <div className="space-y-6">
      {jobs.length > 0 ? (
        jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            hasConflict={hasTimeConflict(job)}
            openRoutePreview={openRoutePreview}
            userInterests={userInterests}
            onInterestChange={fetchUserInterests}
          />
        ))
      ) : (
        <p className="text-gray-600">No available jobs match your criteria.</p>
      )}

      {selectedJob && (
        <RoutePreviewModal
          isOpen={isRouteModalOpen}
          onClose={closeRoutePreview}
          origin={getOriginAddress()}
          destination={getDestinationAddress(selectedJob)}
          jobTitle={selectedJob.title}
        />
      )}
    </div>
  );
}