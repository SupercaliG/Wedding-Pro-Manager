import { createClient } from "@/utils/supabase/server";
import { isEmployee, getCurrentUserProfile } from "@/utils/supabase/auth-helpers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDropRequestsForEmployee } from "@/app/drop-request-actions";
import EmployeeScheduleClient from "./schedule-client";

export default async function EmployeeSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is employee
  const hasAccess = await isEmployee();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get current user profile
  const profile = await getCurrentUserProfile();

  // Get employee's job assignments
  const { data: jobAssignments, error: jobAssignmentsError } = await supabase
    .from('job_assignments')
    .select(`
      id,
      job_id,
      job_required_role_id,
      job:job_id (
        id,
        title,
        description,
        start_time,
        end_time,
        status,
        venue_id,
        venue:venue_id (
          id, name, address, city, state, zip
        )
      ),
      job_required_role:job_required_role_id (
        id, role_name
      )
    `)
    .eq('user_id', user.id)
    .order('job.start_time', { ascending: true });

  // Get employee's drop requests
  const { data: dropRequests } = await getDropRequestsForEmployee();

  // If we're still using placeholder data, keep it
  // In a real implementation, we would use the jobAssignments data
  const scheduledJobs = jobAssignmentsError || !jobAssignments ? [
    // Placeholder data
    {
      id: 1,
      title: 'Wedding Photography',
      client: 'Johnson Family',
      venue: 'Grand Plaza Hotel',
      address: '123 Main St, Cityville',
      date: '2025-06-15',
      time: '14:00 - 20:00',
      role: 'Lead Photographer',
      status: 'confirmed',
      notes: 'Bring extra lighting equipment. Client requested emphasis on candid shots.'
    },
    {
      id: 2,
      title: 'Corporate Event',
      client: 'Tech Solutions Inc.',
      venue: 'Business Center',
      address: '456 Commerce Ave, Techtown',
      date: '2025-06-20',
      time: '09:00 - 17:00',
      role: 'Assistant',
      status: 'confirmed',
      notes: 'Business casual attire required. Focus on capturing speakers and networking moments.'
    },
    {
      id: 6,
      title: 'Graduation Ceremony',
      client: 'City University',
      venue: 'University Auditorium',
      address: '789 Education Blvd, Collegetown',
      date: '2025-07-15',
      time: '10:00 - 14:00',
      role: 'Second Shooter',
      status: 'pending',
      notes: 'Large venue. Coordinate with lead photographer for position assignments.'
    },
  ] : [];

  // Group jobs by month for the calendar view
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Generate calendar days for the current month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const calendarDays = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Find jobs scheduled for this day
    const jobsForDay = scheduledJobs.filter(job => job.date === dateString);
    
    calendarDays.push({
      day,
      date: dateString,
      jobs: jobsForDay
    });
  }

  // Format month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[currentMonth];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">My Schedule</h1>
      
      <EmployeeScheduleClient
        scheduledJobs={scheduledJobs}
        jobAssignments={jobAssignments || []}
        dropRequests={dropRequests || []}
      />
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{currentMonthName} {currentYear} Calendar</h2>
          <div className="flex space-x-2">
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={index} className="text-center font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((dayData, index) => (
            <div 
              key={index} 
              className={`border rounded-md p-2 min-h-[100px] ${
                dayData === null 
                  ? 'bg-gray-50' 
                  : dayData.day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
                  ? 'border-blue-500 border-2'
                  : 'hover:bg-gray-50'
              }`}
            >
              {dayData !== null && (
                <>
                  <div className="text-right text-sm font-medium mb-1">
                    {dayData.day}
                  </div>
                  
                  {dayData.jobs.length > 0 && (
                    <div className="space-y-1">
                      {dayData.jobs.map(job => (
                        <Link 
                          key={job.id}
                          href={`/dashboard/employee/jobs/${job.id}`}
                          className={`block text-xs p-1 rounded truncate ${
                            job.status === 'confirmed' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {job.time.split(' - ')[0]} {job.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}