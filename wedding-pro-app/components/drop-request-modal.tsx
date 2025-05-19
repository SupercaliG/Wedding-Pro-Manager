"use client";

import { useState } from "react";
import { createDropRequest } from "@/app/drop-request-actions";
import { Button } from "@/components/ui/button";

interface DropRequestModalProps {
  jobAssignmentId: string;
  jobTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DropRequestModal({
  jobAssignmentId,
  jobTitle,
  onClose,
  onSuccess
}: DropRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError("Please provide a reason for your drop request");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await createDropRequest(jobAssignmentId, reason);
      
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to submit drop request");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Request to Drop Job</h2>
        
        <p className="text-gray-600 mb-4">
          You are requesting to drop the following job: <span className="font-medium">{jobTitle}</span>
        </p>
        
        <p className="text-gray-600 mb-4">
          Please provide a detailed reason for your request. This will be reviewed by management.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Drop Request
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Please explain why you need to drop this job..."
              required
            />
          </div>
          
          {error && (
            <div className="mb-4 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}