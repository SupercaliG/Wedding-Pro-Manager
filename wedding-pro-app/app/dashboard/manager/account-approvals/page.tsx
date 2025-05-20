import { createClient } from "@/utils/supabase/server";
import { getCurrentUserProfile, isManager } from "@/utils/supabase/auth-helpers";
import { getPendingAccountsViaEdgeFunction, processAccountApprovalViaEdgeFunction } from "@/app/user-management-actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

// Client component for the account approvals table with interactive features
"use client";
function AccountApprovalsClient({ pendingAccounts }: { pendingAccounts: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortField, setSortField] = useState("application_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const { toast } = useToast();

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort accounts
  const filteredAccounts = pendingAccounts
    .filter((account) => {
      // For managers, only show Employee accounts
      if (account.role !== 'Employee') {
        return false;
      }
      
      // Apply search filter
      const searchMatch =
        account.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.auth_users?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply date filter if set
      let dateMatch = true;
      if (dateFilter) {
        const accountDate = new Date(account.created_at).toISOString().split('T')[0];
        dateMatch = accountDate === dateFilter;
      }
      
      return searchMatch && dateMatch;
    })
    .sort((a, b) => {
      // Apply sorting
      let aValue, bValue;
      
      switch (sortField) {
        case "name":
          aValue = a.full_name || "";
          bValue = b.full_name || "";
          break;
        case "email":
          aValue = a.auth_users?.email || "";
          bValue = b.auth_users?.email || "";
          break;
        case "application_date":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle approve action
  const handleApprove = (userId: string) => {
    setSelectedUserId(userId);
    setShowApproveModal(true);
  };

  // Handle reject action
  const handleReject = (userId: string) => {
    setSelectedUserId(userId);
    setShowRejectModal(true);
  };

  // Confirm approve
  const confirmApprove = async () => {
    try {
      setShowApproveModal(false);
      toast({
        title: "Account Approved",
        description: "The employee account has been approved successfully.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve the account. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Confirm reject
  const confirmReject = async () => {
    try {
      setShowRejectModal(false);
      toast({
        title: "Account Rejected",
        description: "The employee account has been rejected.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject the account. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <input
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-md"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Accounts table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("name")}
              >
                Name <SortIndicator field="name" />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("email")}
              >
                Email <SortIndicator field="email" />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("application_date")}
              >
                Application Date <SortIndicator field="application_date" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {account.full_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {account.auth_users?.email || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(account.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {account.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <form action={processAccountApprovalViaEdgeFunction}>
                        <input type="hidden" name="userId" value={account.id} />
                        <input type="hidden" name="action" value="approve" />
                        <Button 
                          type="submit"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            handleApprove(account.id);
                          }}
                        >
                          Approve
                        </Button>
                      </form>
                      <form action={processAccountApprovalViaEdgeFunction}>
                        <input type="hidden" name="userId" value={account.id} />
                        <input type="hidden" name="action" value="reject" />
                        <Button 
                          type="submit"
                          className="bg-red-500 hover:bg-red-600 text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            handleReject(account.id);
                          }}
                        >
                          Reject
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No pending employee accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Confirm Approval</h3>
              <p className="mb-6">Are you sure you want to approve this employee account? They will gain access to the employee features of the system.</p>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowApproveModal(false)}
                >
                  Cancel
                </Button>
                <form action={processAccountApprovalViaEdgeFunction}>
                  <input type="hidden" name="userId" value={selectedUserId} />
                  <input type="hidden" name="action" value="approve" />
                  <Button 
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    onClick={confirmApprove}
                  >
                    Confirm Approval
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Reject Confirmation Modal */}
      {showRejectModal && (
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Confirm Rejection</h3>
              <p className="mb-6">Are you sure you want to reject this employee account? They will not be able to access the system.</p>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </Button>
                <form action={processAccountApprovalViaEdgeFunction}>
                  <input type="hidden" name="userId" value={selectedUserId} />
                  <input type="hidden" name="action" value="reject" />
                  <Button 
                    type="submit"
                    className="bg-red-500 hover:bg-red-600 text-white"
                    onClick={confirmReject}
                  >
                    Confirm Rejection
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// Server component for the page
export default async function ManagerAccountApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // Check if user is manager
  const hasAccess = await isManager();
  if (!hasAccess) {
    redirect("/dashboard");
  }
  
  // Get pending accounts
  const { data: pendingAccounts, error } = await getPendingAccountsViaEdgeFunction();
  
  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Employee Account Approvals</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading pending accounts: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Employee Account Approvals</h1>
      <p className="text-gray-600 mb-6">
        Review and manage pending employee account approval requests. Approved employees will gain access to the system.
      </p>
      
      <AccountApprovalsClient pendingAccounts={pendingAccounts || []} />
    </div>
  );
}