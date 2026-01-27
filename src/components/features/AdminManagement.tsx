"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserPlus, Edit, Trash2, Loader2, Lock, Clock, Mail } from "lucide-react";
import { useSupabaseAuth } from "@/redux/hooks/useSupabaseAuth";

interface AdminUser {
  user_id: string;      // profiles.id
  email: string;
  role: string;
  created_at: string;
  full_name?: string | null;
}

interface ActivityLog {
  id: number;
  admin_user_id: string;
  admin_email: string;
  admin_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

export default function AdminManagement() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();

  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  // NOTE: when creating, we only need userId + role.
  // email is optional now because profiles already has email.
  const [formState, setFormState] = useState({ email: "", role: "manager" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"admins" | "logs">("admins");

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      if (!user) {
        router.replace("/");
        return;
      }

      try {
        // Get my role from server (trusted)
        const res = await fetch("/api/users/me", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load /api/users/me");
        const me = await res.json();

        const role = me?.adminRole ? String(me.adminRole).replace(/\s+/g, "_") : null;
        setAdminRole(role);

        // Only super_admin can access this page
        if (role !== "super_admin") {
          router.replace("/");
          return;
        }

        await Promise.all([fetchAdminUsers(), fetchActivityLogs()]);
      } catch (e) {
        console.error("Access check error:", e);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchAdminUsers = async () => {
    try {
      const response = await fetch(`/api/admin/users?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!response.ok) throw new Error("Failed to fetch admin users");

      const data: AdminUser[] = await response.json();
      setAdminUsers(data);
    } catch (err) {
      console.error("Error fetching admin users:", err);
      setError("Failed to load admin users.");
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await fetch(`/api/admin/activity-logs?limit=50&t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      // If you haven't created logs yet, we allow empty list
      if (!response.ok) {
        setActivityLogs([]);
        return;
      }

      const data: ActivityLog[] = await response.json();
      setActivityLogs(data);
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setActivityLogs([]);
    }
  };

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormState({ email: "", role: "manager" });
    setShowModal(true);
  };

  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormState({ email: admin.email, role: admin.role });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    setFormState({ email: "", role: "manager" });
    setError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingAdmin) {
        // Update role only
        const response = await fetch(`/api/admin/users/${editingAdmin.user_id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: formState.role }),
        });

        const out = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(out?.error || "Failed to update admin role");
      } else {
        // Promote existing user to admin role (user must already exist in profiles)
        const response = await fetch("/api/admin/users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formState.email.trim(),
            role: formState.role,
          }),
        });

        const out = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(out?.error || "Failed to create admin user");
      }

      closeModal();
      await Promise.all([fetchAdminUsers(), fetchActivityLogs()]);
    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this admin? They will be set back to 'user'.")) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const out = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(out?.error || "Failed to remove admin");

      await Promise.all([fetchAdminUsers(), fetchActivityLogs()]);
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err.message || "Failed to remove admin.");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "manager":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "blog_manager":
        return "bg-green-100 text-green-700 border-green-200";
      case "customer_support":
        return "bg-teal-100 text-teal-700 border-teal-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "manager":
        return "Manager";
      case "blog_manager":
        return "Blog Manager";
      case "customer_support":
        return "Customer Support";
      default:
        return role;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin management...</p>
        </div>
      </div>
    );
  }

  if (adminRole !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only super admins can access admin management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Admin Management
              </h1>
              <p className="text-gray-600">
                Promote users to admins and manage roles
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Add Admin
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab("admins")}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "admins"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin Users ({adminUsers.length})
                </div>
              </button>

              <button
                onClick={() => setActiveTab("logs")}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "logs"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Activity Logs ({activityLogs.length})
                </div>
              </button>
            </nav>
          </div>
        </div>

        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Admin Users Tab */}
        {activeTab === "admins" && (
          <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            {adminUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {adminUsers.map((admin) => (
                      <tr
                        key={admin.user_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                              <Mail className="h-5 w-5 text-primary-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {admin.email}
                              </div>
                              {admin.full_name ? (
                                <div className="text-xs text-gray-500">
                                  {admin.full_name}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadgeColor(
                              admin.role
                            )}`}
                          >
                            {getRoleLabel(admin.role)}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 font-mono">
                            {admin.user_id.substring(0, 12)}...
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {admin.user_id !== user?.id ? (
                            <>
                              <button
                                onClick={() => openEditModal(admin)}
                                className="text-primary-600 hover:text-primary-900 mr-4"
                                title="Edit Role"
                              >
                                <Edit className="w-4 h-4 inline" />
                              </button>

                              <button
                                onClick={() => handleDelete(admin.user_id)}
                                className="text-red-600 hover:text-red-900"
                                title="Remove Admin"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">You</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No admin users</p>
                <p className="text-sm">Click "Add Admin" to promote a user.</p>
              </div>
            )}
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === "logs" && (
          <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            {activityLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {activityLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {log.admin_email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getRoleLabel(log.admin_role)}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.details || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No activity logs</p>
                <p className="text-sm">
                  Admin actions will appear here (after logs table is added).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="relative p-8 bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              {editingAdmin ? "Edit Admin Role" : "Add New Admin"}
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {!editingAdmin && (
                <>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formState.email}
                      onChange={handleFormChange}
                      required
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The user must have signed up already (a profiles row must
                      exist).
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formState.email}
                      onChange={handleFormChange}
                      placeholder="admin@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Not required — email is taken from profiles. This is just
                      for your UI.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Role *
                </label>
                <select
                  name="role"
                  id="role"
                  value={formState.role}
                  onChange={handleFormChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="super_admin">Super Admin (Full Access)</option>
                  <option value="manager">Manager (Dashboard Only)</option>
                  <option value="blog_manager">Blog Manager (Blog Only)</option>
                  <option value="customer_support">
                    Customer Support (Contact Forms)
                  </option>
                </select>

                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p>
                    <strong>Super Admin:</strong> Full access + can assign roles
                  </p>
                  <p>
                    <strong>Manager:</strong> Dashboard access
                  </p>
                  <p>
                    <strong>Blog Manager:</strong> Blog access
                  </p>
                  <p>
                    <strong>Customer Support:</strong> Contact submissions
                    access
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-white gradient-primary rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingAdmin ? "Updating..." : "Creating..."}
                    </>
                  ) : editingAdmin ? (
                    "Update Role"
                  ) : (
                    "Add Admin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
