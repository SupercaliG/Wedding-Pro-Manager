"use client";

import { useState } from "react";
import { assignJobToEmployee, InterestedEmployee } from "@/app/job-assignment-actions";
import { useRouter } from "next/navigation";

interface RoleCapacity {
  id: string;
  role_name: string;
  quantity_needed: number;
  assigned: number;
}

interface JobRoleAssignmentProps {
  jobId: string;
  roleCapacity: RoleCapacity[];
  interestedEmployees: InterestedEmployee[];
}

export default function JobRoleAssignment({
  jobId,
  roleCapacity,
  interestedEmployees
}: JobRoleAssignmentProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Handle role selection
  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId === selectedRole ? null : roleId);
    setError(null);
    setSuccess(null);
  };
  
  // Handle employee assignment
  const handleAssignEmployee = async (employeeId: string) => {
    if (!selectedRole) {
      setError("Please select a role first");
      return;
    }
    
    setIsAssigning(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await assignJobToEmployee(jobId, employeeId, selectedRole);
      
      if (result.success) {
        setSuccess(result.message || "Employee assigned successfully");
        // Refresh the page to show updated assignments
        router.refresh();
      } else {
        setError(result.error || "Failed to assign employee");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsAssigning(false);
    }
  };
  
  // Get the selected role details
  const getSelectedRoleDetails = () => {
    if (!selectedRole) return null;
    return roleCapacity.find(role => role.id === selectedRole);
  };
  
  const selectedRoleDetails = getSelectedRoleDetails();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Job Roles</h2>
      
      {roleCapacity.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p>No roles defined for this job.</p>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Select a role to assign:</h3>
            <div className="space-y-2">
              {roleCapacity.map((role) => (
                <div 
                  key={role.id}
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedRole === role.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleRoleSelect(role.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{role.role_name}</div>
                    <div className="text-sm text-gray-500">
                      {role.assigned} of {role.quantity_needed} filled
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(role.assigned / role.quantity_needed) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {selectedRoleDetails && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Assign {selectedRoleDetails.role_name}:
              </h3>
              
              {selectedRoleDetails.assigned >= selectedRoleDetails.quantity_needed ? (
                <div className="text-amber-600 text-sm">
                  All positions for this role are filled.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {interestedEmployees.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      No employees have expressed interest in this job.
                    </div>
                  ) : (
                    interestedEmployees.map((employee) => (
                      <div 
                        key={employee.id}
                        className="border border-gray-200 rounded-md p-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{employee.profile?.full_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">
                            {employee.profile?.role || 'No role'} • 
                            {employee.distance !== null ? ` ${employee.distance} miles` : ' Distance unknown'}
                          </div>
                        </div>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
                          onClick={() => handleAssignEmployee(employee.user_id)}
                          disabled={isAssigning}
                        >
                          {isAssigning ? 'Assigning...' : 'Assign'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
              {success}
            </div>
          )}
        </div>
      )}
    </div>
  );
}