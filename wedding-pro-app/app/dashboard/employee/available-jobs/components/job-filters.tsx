"use client";

import { useState, useEffect } from "react";

export interface JobFilters {
  role: string;
  distance: string;
  status: string;
}

interface JobFiltersProps {
  availableRoles: string[];
  onFilterChange: (filters: JobFilters) => void;
  initialFilters?: JobFilters;
}

export function JobFilters({ availableRoles, onFilterChange, initialFilters }: JobFiltersProps) {
  const [filters, setFilters] = useState<JobFilters>(
    initialFilters || {
      role: "",
      distance: "",
      status: ""
    }
  );

  // Apply filters when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFilterChange(filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters, onFilterChange]);

  const handleFilterChange = (key: keyof JobFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Find Jobs</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={filters.role}
            onChange={(e) => handleFilterChange("role", e.target.value)}
          >
            <option value="">All Roles</option>
            {availableRoles.map((role, index) => (
              <option key={index} value={role}>{role}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={filters.distance}
            onChange={(e) => handleFilterChange("distance", e.target.value)}
          >
            <option value="">Any Distance</option>
            <option value="5">Within 5 miles</option>
            <option value="10">Within 10 miles</option>
            <option value="25">Within 25 miles</option>
            <option value="50">Within 50 miles</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select 
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="">Any Status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="available">Available</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            onClick={() => onFilterChange(filters)}
          >
            Search Jobs
          </button>
        </div>
      </div>
    </div>
  );
}