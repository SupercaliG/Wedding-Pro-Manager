"use client";

import { useState } from "react";
import { approveDropRequest, rejectDropRequest } from "@/app/drop-request-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

interface DropRequest {
  id: string;
  job_assignment_id: string;
  user_id: string;
  reason: string;
  status: string;
  requested_at: string;
  resolved_at?: string;
  resolved_by_user_id?: string;
  employee?: {
    id: string;
    full_name: string;
    email: string;
  };
  job_assignment?: {
    id: string;
    job_id: string;
    job_required_role_id: string;
    job?: {
      id: string;
      title: string;
      org_id: string;
      start_time: string;
      end_time: string;
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
  };
}

interface ManagerDropRequestsClientProps {
  pendingRequests: DropRequest[];
  resolvedRequests: DropRequest[];
  escalatedRequests: DropRequest[];
}

export default function ManagerDropRequestsClient({
  pendingRequests,
  resolvedRequests,
  escalatedRequests
}: ManagerDropRequestsClientProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      const result = await approveDropRequest(requestId);
      
      if (result.success) {
        setSuccessMessage(result.message || "Drop request approved successfully");
        // Refresh the page to update the lists
        window.location.reload();
      } else {
        setErrorMessage(result.error || "Failed to approve drop request");
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred");
      console.error(err);
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      const result = await rejectDropRequest(requestId);
      
      if (result.success) {
        setSuccessMessage(result.message || "Drop request rejected successfully");
        // Refresh the page to update the lists
        window.location.reload();
      } else {
        setErrorMessage(result.error || "Failed to reject drop request");
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred");
      console.error(err);
    } finally {
      setProcessingRequestId(null);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  const renderDropRequestCard = (request: DropRequest, showActions: boolean = false) => {
    const jobTitle = request.job_assignment?.job?.title || 'Unknown Job';
    const roleName = request.job_assignment?.job_required_role?.role_name || 'Unknown Role';
    const employeeName = request.employee?.full_name || 'Unknown Employee';
    const venueName = request.job_assignment?.job?.venue?.name || 'Unknown Venue';
    const jobDate = request.job_assignment?.job?.start_time 
      ? new Date(request.job_assignment.job.start_time).toLocaleDateString()
      : 'Unknown Date';
    const jobTime = request.job_assignment?.job?.start_time && request.job_assignment?.job?.end_time
      ? `${new Date(request.job_assignment.job.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(request.job_assignment.job.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
      : 'Unknown Time';
    
    return (
      <div key={request.id} className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col md:flex-row justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">{jobTitle}</h3>
            <p className="text-sm text-gray-600">
              {roleName} • {venueName} • {jobDate} • {jobTime}
            </p>
          </div>
          <div className="mt-2 md:mt-0">
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              request.status === 'approved' ? 'bg-green-100 text-green-800' :
              request.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">Employee:</p>
          <p className="text-sm text-gray-600">{employeeName}</p>
        </div>
        
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">Reason for Drop Request:</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{request.reason}</p>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Requested {formatTimeAgo(request.requested_at)} ({formatDate(request.requested_at)})
          </p>
          {request.resolved_at && (
            <p className="text-sm text-gray-600">
              Resolved {formatTimeAgo(request.resolved_at)} ({formatDate(request.resolved_at)})
            </p>
          )}
        </div>
        
        {showActions && (
          <div className="flex space-x-2">
            <Button
              onClick={() => handleApprove(request.id)}
              disabled={processingRequestId === request.id}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingRequestId === request.id ? "Processing..." : "Approve"}
            </Button>
            <Button
              onClick={() => handleReject(request.id)}
              disabled={processingRequestId === request.id}
              variant="destructive"
            >
              {processingRequestId === request.id ? "Processing..." : "Reject"}
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div>
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      <Tabs defaultValue="pending" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="escalated">
            Escalated ({escalatedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolvedRequests.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          {pendingRequests.length > 0 ? (
            <div>
              {pendingRequests.map(request => renderDropRequestCard(request, true))}
            </div>
          ) : (
            <p className="text-gray-600">No pending drop requests.</p>
          )}
        </TabsContent>
        
        <TabsContent value="escalated">
          {escalatedRequests.length > 0 ? (
            <div>
              <p className="text-gray-600 mb-4">
                These requests have been escalated to admin due to the 24-hour SLA. Managers cannot approve or reject escalated requests.
              </p>
              {escalatedRequests.map(request => renderDropRequestCard(request, false))}
            </div>
          ) : (
            <p className="text-gray-600">No escalated drop requests.</p>
          )}
        </TabsContent>
        
        <TabsContent value="resolved">
          {resolvedRequests.length > 0 ? (
            <div>
              {resolvedRequests.map(request => renderDropRequestCard(request, false))}
            </div>
          ) : (
            <p className="text-gray-600">No resolved drop requests.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}