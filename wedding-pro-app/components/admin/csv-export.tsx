"use client";

import { useState } from "react";
import { exportToCSV, CSVExportOptions } from "@/app/actions/csv-export";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download } from "lucide-react";

interface CSVExportProps {
  className?: string;
}

export function CSVExport({ className }: CSVExportProps) {
  // State for export options
  const [dataScope, setDataScope] = useState<string>("jobs");
  const [includeSubtasks, setIncludeSubtasks] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<string>("all");
  
  // State for field selection
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    id: true,
    title: true,
    description: true,
    start_time: true,
    end_time: true,
    venue_name: true,
    venue_address: true,
    status: true,
    travel_pay_offered: true,
    travel_pay_amount: true,
    created_at: true,
    completed_at: true,
    first_assigned_at: true,
    time_to_fill_duration: true,
    assignment_to_completion_duration: true,
  });

  // Toggle field selection
  const toggleField = (field: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Handle export button click
  const handleExport = async () => {
    try {
      // Prepare export options
      const options: CSVExportOptions = {
        dataScope: dataScope as 'jobs' | 'users' | 'venues',
        includeSubtasks,
        dateRange: dateRange as 'all' | 'month' | 'quarter' | 'year',
        selectedFields
      };
      
      console.log("Export options:", options);
      
      // Call the server action
      const result = await exportToCSV(options);
      
      if (result.success && result.data) {
        // Create a blob from the CSV data
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        // Create a link and trigger download
        const a = document.createElement('a');
        a.href = url;
        
        // Use the filename from the server if available, otherwise generate one
        const filename = result.filename || `${dataScope}-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Show error message
        alert(result.error || "Failed to export data. Please try again.");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("An error occurred while exporting data. Please try again.");
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Export Data to CSV</h3>
      
      <div className="space-y-4">
        {/* Data Scope Selection */}
        <div>
          <Label className="text-sm font-medium mb-1 block">Data Type</Label>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="scope-jobs" 
                name="data-scope" 
                value="jobs" 
                checked={dataScope === "jobs"}
                onChange={() => setDataScope("jobs")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="scope-jobs" className="text-sm">Jobs</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="scope-users" 
                name="data-scope" 
                value="users" 
                checked={dataScope === "users"}
                onChange={() => setDataScope("users")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="scope-users" className="text-sm">Users</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="scope-venues" 
                name="data-scope" 
                value="venues" 
                checked={dataScope === "venues"}
                onChange={() => setDataScope("venues")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="scope-venues" className="text-sm">Venues</Label>
            </div>
          </div>
        </div>
        
        {/* Date Range Selection */}
        <div>
          <Label className="text-sm font-medium mb-1 block">Date Range</Label>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="date-all" 
                name="date-range" 
                value="all" 
                checked={dateRange === "all"}
                onChange={() => setDateRange("all")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="date-all" className="text-sm">All Time</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="date-month" 
                name="date-range" 
                value="month" 
                checked={dateRange === "month"}
                onChange={() => setDateRange("month")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="date-month" className="text-sm">Last Month</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="date-quarter" 
                name="date-range" 
                value="quarter" 
                checked={dateRange === "quarter"}
                onChange={() => setDateRange("quarter")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="date-quarter" className="text-sm">Last Quarter</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="radio" 
                id="date-year" 
                name="date-range" 
                value="year" 
                checked={dateRange === "year"}
                onChange={() => setDateRange("year")}
                className="h-4 w-4 text-primary"
              />
              <Label htmlFor="date-year" className="text-sm">Last Year</Label>
            </div>
          </div>
        </div>
        
        {/* Include Subtasks Option (only for jobs) */}
        {dataScope === "jobs" && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="include-subtasks" 
              checked={includeSubtasks}
              onCheckedChange={() => setIncludeSubtasks(!includeSubtasks)}
            />
            <Label htmlFor="include-subtasks" className="text-sm">Include job assignments</Label>
          </div>
        )}
        
        {/* Field Selection Dropdown */}
        <div>
          <Label className="text-sm font-medium mb-1 block">Fields to Include</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Select Fields
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Select Fields</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.keys(selectedFields).map((field) => (
                <DropdownMenuCheckboxItem
                  key={field}
                  checked={selectedFields[field]}
                  onCheckedChange={() => toggleField(field)}
                >
                  {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Export Button */}
        <Button 
          className="w-full"
          onClick={handleExport}
        >
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>
    </div>
  );
}