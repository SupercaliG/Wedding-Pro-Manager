"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { InterestedEmployee, SortOption } from "@/app/job-assignment-actions";

interface InterestedEmployeesListProps {
  jobId: string;
  interestedEmployees: InterestedEmployee[];
  currentSort: SortOption;
}

export default function InterestedEmployeesList({
  jobId,
  interestedEmployees,
  currentSort
}: InterestedEmployeesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Handle sort change
  const handleSortChange = (sortOption: SortOption) => {
    router.push(`${pathname}?sort=${sortOption}`);
  };
  
  // Format date for display
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-xl font-semibold mb-2 md:mb-0">
          Interested Employees ({interestedEmployees.length})
        </h2>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
          >
            <option value="lastAssignmentDate_asc">Last Assignment (Oldest First)</option>
            <option value="lastAssignmentDate_desc">Last Assignment (Recent First)</option>
            <option value="distance_asc">Distance (Closest First)</option>
            <option value="distance_desc">Distance (Furthest First)</option>
            <option value="interestDate_asc">Interest Date (Oldest First)</option>
            <option value="interestDate_desc">Interest Date (Recent First)</option>
          </select>
        </div>
      </div>
      
      {interestedEmployees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No employees have expressed interest in this job yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Assignment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interest Expressed
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {interestedEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.profile?.full_name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {employee.profile?.email || 'No email'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.profile?.role || 'Not specified'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.distance !== null ? `${employee.distance} miles` : 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(employee.last_assignment_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(employee.expressed_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}