"use client";

import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { AvailableJob } from "@/app/actions/jobs";
import { expressInterest, withdrawInterest } from "@/app/job-interest-actions";
import { useState } from "react";
import { toast } from "sonner";

interface JobCardProps {
  job: AvailableJob;
  hasConflict: boolean;
  openRoutePreview: (job: AvailableJob) => void;
  userInterests: string[];
  onInterestChange?: () => void;
}

export function JobCard({ job, hasConflict, openRoutePreview, userInterests, onInterestChange }: JobCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const hasExpressedInterest = userInterests.includes(job.id);
  // Format date and time
  const formatDateTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const dateStr = format(start, "MMM d, yyyy");
    const timeStr = `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
    
    return { dateStr, timeStr };
  };
  
  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "open":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case "available":
        return "Available";
      case "pending":
        return "Pending";
      case "open":
        return "Open for Applications";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };
  
  const { dateStr, timeStr } = formatDateTime(job.start_time, job.end_time);
  
  return (
    <div 
      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
        hasConflict ? 'opacity-60 bg-gray-50' : ''
      }`}
    >
      {hasConflict && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-md p-2 text-red-700 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Time conflict with another job
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-2">
        <h3 className="text-lg font-medium">{job.title}</h3>
        <div className="flex items-center flex-wrap gap-2 mt-2 md:mt-0">
          {job.travel_pay_offered && job.travel_pay_amount && (
            <Badge className="bg-green-100 text-green-800 mr-2">
              Travel Pay: ${job.travel_pay_amount}
            </Badge>
          )}
          <Badge className={getStatusBadgeVariant(job.status)}>
            {formatStatus(job.status)}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          {job.venue && (
            <>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Venue:</span> {job.venue.name}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Address:</span> {job.venue.address}, {job.venue.city}, {job.venue.state} {job.venue.zip}
              </p>
              {job.distance !== null && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Distance:</span> {job.distance} miles
                </p>
              )}
            </>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Date:</span> {dateStr}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Time:</span> {timeStr}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Roles Needed:</span> {job.job_required_roles?.map(r => r.role_name).join(', ') || 'No specific roles'}
          </p>
        </div>
      </div>
      
      {job.description && (
        <p className="text-sm text-gray-600 mb-4">{job.description}</p>
      )}
      
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => openRoutePreview(job)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
            disabled={!job.venue}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            View Route
          </button>
          
          <Link 
            href={`/dashboard/employee/jobs/${job.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Details
          </Link>
        </div>
        
        {hasExpressedInterest ? (
          <button
            className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm ${
              isLoading ? 'opacity-75 cursor-wait' : ''
            }`}
            disabled={isLoading}
            onClick={async () => {
              try {
                setIsLoading(true);
                const result = await withdrawInterest(job.id);
                
                if (result.success) {
                  toast.success(result.message);
                  if (onInterestChange) onInterestChange();
                } else {
                  toast.error(result.message);
                }
              } catch (error) {
                toast.error("Failed to withdraw interest");
                console.error(error);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? 'Processing...' : 'Withdraw Interest'}
          </button>
        ) : (
          <button
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm ${
              hasConflict || isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={hasConflict || isLoading}
            onClick={async () => {
              try {
                setIsLoading(true);
                const result = await expressInterest(job.id);
                
                if (result.success) {
                  toast.success(result.message);
                  if (onInterestChange) onInterestChange();
                } else {
                  toast.error(result.message);
                }
              } catch (error) {
                toast.error("Failed to express interest");
                console.error(error);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? 'Processing...' : 'Express Interest'}
          </button>
        )}
      </div>
    </div>
  );
}