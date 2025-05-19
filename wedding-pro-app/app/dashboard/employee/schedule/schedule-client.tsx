"use client";

import { useState } from "react";
import Link from "next/link";
import DropRequestModal from "@/components/drop-request-modal";
import { Badge } from "@/components/ui/badge";

interface Job {
  id: string | number;
  assignmentId?: string;
  title: string;
  client: string;
  venue: string;
  address: string;
  date: string;
  time: string;
  status: string;
  role: string;
  notes?: string;
}

interface JobAssignment {
  id: string;
  job_id: string;
  job_required_role_id: string;
  job?: {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    status: string;
    venue_id: string;
    venue?: {
      id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  job_required_role?: {
    id: string;
    role_name: string;
  };
}

interface DropRequest {
  id: string;
  job_assignment_id: string;
  reason: string;
  status: string;
  requested_at: string;
  resolved_at?: string;
  job_assignment?: JobAssignment;
}

interface EmployeeScheduleClientProps {
  scheduledJobs: Job[];
  jobAssignments: JobAssignment[];
  dropRequests: DropRequest[];
}

export default function EmployeeScheduleClient({
  scheduledJobs,
  jobAssignments,
  dropRequests
}: EmployeeScheduleClientProps) {
  const [showDropRequestModal, setShowDropRequestModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if a job has an active drop request
  const hasActiveDropRequest = (jobId: string | number, assignmentId?: string) => {
    if (assignmentId) {
      return dropRequests.some(
        req => req.job_assignment_id === assignmentId && 
        (req.status === 'pending' || req.status === 'escalated')
      );
    }
    
    // For placeholder data without assignment IDs
    return dropRequests.some(
      req => req.job_assignment?.job_id === jobId.toString() && 
      (req.status === 'pending' || req.status === 'escalated')
    );
  };

  // Get drop request status for a job
  const getDropRequestStatus = (jobId: string | number, assignmentId?: string) => {
    if (assignmentId) {
      const request = dropRequests.find(
        req => req.job_assignment_id === assignmentId
      );
      return request?.status;
    }
    
    // For placeholder data without assignment IDs
    const request = dropRequests.find(
      req => req.job_assignment?.job_id === jobId.toString()
    );
    return request?.status;
  };

  const handleRequestDrop = (job: Job) => {
    setSelectedJob(job);
    setShowDropRequestModal(true);
  };

  const handleDropRequestSuccess = () => {
    setShowDropRequestModal(false);
    setSuccessMessage("Drop request submitted successfully");
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  return (
    <>
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Jobs</h2>
        
        {scheduledJobs.length > 0 ? (
          <div className="space-y-4">
            {scheduledJobs.map((job) => {
              const hasDropRequest = hasActiveDropRequest(job.id, job.assignmentId);
              const dropStatus = getDropRequestStatus(job.id, job.assignmentId);
              
              return (
                <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-2">
                    <h3 className="text-lg font-medium">{job.title}</h3>
                    <div className="flex space-x-2 items-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.status === 'confirmed' || job.status === 'upcoming'
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                      
                      {hasDropRequest && (
                        <Badge variant="outline" className={
                          dropStatus === 'pending' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                          dropStatus === 'escalated' ? 'bg-red-100 text-red-800 border-red-300' :
                          dropStatus === 'approved' ? 'bg-green-100 text-green-800 border-green-300' :
                          'bg-gray-100 text-gray-800 border-gray-300'
                        }>
                          Drop {dropStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Client:</span> {job.client}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Venue:</span> {job.venue}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Address:</span> {job.address}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Date:</span> {new Date(job.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Time:</span> {job.time}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Role:</span> {job.role}
                      </p>
                    </div>
                  </div>
                  
                  {job.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {job.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex space-x-2">
                    <Link 
                      href={`/dashboard/employee/jobs/${job.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details
                    </Link>
                    
                    {(job.status === 'confirmed' || job.status === 'upcoming') && !hasDropRequest && job.assignmentId && (
                      <button 
                        onClick={() => handleRequestDrop(job)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Request Drop
                      </button>
                    )}
                    
                    {hasDropRequest && (
                      <span className="text-sm text-gray-600">
                        Drop request {dropStatus}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600">You have no upcoming jobs scheduled.</p>
        )}
      </div>
      
      {showDropRequestModal && selectedJob && (
        <DropRequestModal
          jobAssignmentId={selectedJob.assignmentId || ''}
          jobTitle={selectedJob.title}
          onClose={() => setShowDropRequestModal(false)}
          onSuccess={handleDropRequestSuccess}
        />
      )}
    </>
  );
}