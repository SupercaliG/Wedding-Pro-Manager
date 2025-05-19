import { createClient } from "@/utils/supabase/server";
import { isAdmin } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is admin
  const hasAccess = await isAdmin();
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Placeholder data for audit logs
  const auditLogs = [
    { id: 1, timestamp: '2025-05-17T14:32:45Z', user: 'john.doe@example.com', action: 'User Login', details: 'Successful login', ip: '192.168.1.1' },
    { id: 2, timestamp: '2025-05-17T13:45:22Z', user: 'jane.smith@example.com', action: 'User Created', details: 'New employee account created', ip: '192.168.1.2' },
    { id: 3, timestamp: '2025-05-17T12:18:05Z', user: 'admin@example.com', action: 'User Approved', details: 'Approved employee account', ip: '192.168.1.3' },
    { id: 4, timestamp: '2025-05-17T11:05:33Z', user: 'manager@example.com', action: 'Job Created', details: 'Created new job: Wedding Photography', ip: '192.168.1.4' },
    { id: 5, timestamp: '2025-05-17T10:22:18Z', user: 'john.doe@example.com', action: 'Job Assigned', details: 'Assigned to job #1234', ip: '192.168.1.1' },
    { id: 6, timestamp: '2025-05-16T16:45:12Z', user: 'admin@example.com', action: 'Settings Updated', details: 'Updated organization settings', ip: '192.168.1.3' },
    { id: 7, timestamp: '2025-05-16T15:33:27Z', user: 'jane.smith@example.com', action: 'User Login', details: 'Successful login', ip: '192.168.1.2' },
    { id: 8, timestamp: '2025-05-16T14:12:55Z', user: 'admin@example.com', action: 'User Login', details: 'Successful login', ip: '192.168.1.3' },
    { id: 9, timestamp: '2025-05-16T13:05:41Z', user: 'manager@example.com', action: 'User Login', details: 'Successful login', ip: '192.168.1.4' },
    { id: 10, timestamp: '2025-05-16T11:22:08Z', user: 'john.doe@example.com', action: 'Password Changed', details: 'User changed password', ip: '192.168.1.1' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">System Audit Logs</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-semibold mb-4 md:mb-0">Recent Activity</h2>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search logs..." 
                className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64"
              />
              <svg 
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select className="border border-gray-300 rounded-md px-4 py-2">
              <option value="">All Actions</option>
              <option value="login">User Login</option>
              <option value="create">User Created</option>
              <option value="approve">User Approved</option>
              <option value="job">Job Actions</option>
              <option value="settings">Settings Changes</option>
            </select>
            
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
              Filter
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.action.includes('Login') 
                        ? 'bg-blue-100 text-blue-800' 
                        : log.action.includes('Created') || log.action.includes('Approved')
                        ? 'bg-green-100 text-green-800'
                        : log.action.includes('Changed') || log.action.includes('Updated')
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.details}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">1</span> to <span className="font-medium">10</span> of <span className="font-medium">50</span> results
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-500">
              Previous
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-blue-600 text-white">
              1
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
              2
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
              3
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
              4
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
              5
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700">
              Next
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Export Options</h2>
        <div className="flex flex-wrap gap-4">
          <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export as CSV
          </button>
          <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export as PDF
          </button>
          <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50">
            <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export as JSON
          </button>
        </div>
      </div>
    </div>
  );
}