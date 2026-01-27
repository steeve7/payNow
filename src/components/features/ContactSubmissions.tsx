"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Trash2,
  CheckCircle,
  Eye,
  MessageSquare,
  Clock,
  Filter,
} from "lucide-react";
import { useSupabaseAuth } from "@/redux/hooks/useSupabaseAuth"; // adjust path if different

interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "responded";
  created_at: string;
  updated_at: string;
}

type Role =
  | "user"
  | "super_admin"
  | "manager"
  | "customer_support"
  | "blog_manager"
  | "developer";

export default function ContactSubmissions() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseAuth();

  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubmission, setSelectedSubmission] =
    useState<ContactSubmission | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [role, setRole] = useState<Role | null>(null);

  const canAccess = useMemo(() => {
    return (
      role === "super_admin" ||
      role === "manager" ||
      role === "customer_support"
    );
  }, [role]);

  // 1) Ensure user is logged in, then load role from /api/users/me
  useEffect(() => {
    const run = async () => {
      if (authLoading) return;

      if (!user) {
        router.push("/");
        return;
      }

      try {
        const res = await fetch("/api/users/me", { cache: "no-store" });
        if (!res.ok) {
          router.push("/");
          return;
        }

        const me = await res.json();
        const r = (me.role || me.adminRole || "user") as Role;
        setRole(r);

        // Only super_admin/manager/customer_support can access this page
        if (
          !(r === "super_admin" || r === "manager" || r === "customer_support")
        ) {
          router.push("/");
          return;
        }
      } catch (e) {
        console.error("role check failed:", e);
        router.push("/");
      }
    };

    run();
  }, [user, authLoading, router]);

  // 2) Fetch submissions when role is approved or filter changes
  useEffect(() => {
    if (!canAccess) return;
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, filterStatus]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/contact-submissions?status=${encodeURIComponent(
          filterStatus
        )}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        console.error("Failed to fetch submissions");
        setSubmissions([]);
        return;
      }

      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : data.submissions ?? []);
    } catch (e) {
      console.error("Error fetching submissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: "read" | "responded") => {
    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("Failed updating status:", err);
        return;
      }

      // refresh list
      await fetchSubmissions();

      // update modal state if open
      setSelectedSubmission((prev) =>
        prev?.id === id ? { ...prev, status: newStatus } : prev
      );
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  const deleteSubmission = async (id: number) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;

    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("Failed deleting submission:", err);
        return;
      }

      await fetchSubmissions();

      if (selectedSubmission?.id === id) {
        setShowDetails(false);
        setSelectedSubmission(null);
      }
    } catch (e) {
      console.error("Error deleting submission:", e);
    }
  };

  const handleViewDetails = async (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setShowDetails(true);

    // auto-mark unread -> read when opened
    if (submission.status === "unread") {
      await updateStatus(submission.id, "read");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unread":
        return "bg-blue-100 text-blue-700";
      case "read":
        return "bg-yellow-100 text-yellow-700";
      case "responded":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "unread":
        return <Mail className="w-4 h-4" />;
      case "read":
        return <Eye className="w-4 h-4" />;
      case "responded":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading screen while auth + role check + first fetch happens
  if (authLoading || (role === null && user) || loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in but doesn't have access (extra safety)
  if (!canAccess) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Contact Submissions
          </h1>
          <p className="text-gray-600">
            View and manage contact form submissions from customers
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                  <option value="responded">Responded</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                {submissions.length} submission
                {submissions.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {submissions.length > 0 ? (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                  onClick={() => handleViewDetails(submission)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`p-2 rounded-lg ${getStatusColor(
                        submission.status
                      )}`}
                    >
                      {getStatusIcon(submission.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {submission.name}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            submission.status
                          )}`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {submission.subject}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500">
                          {submission.email}
                        </p>
                        <span className="text-gray-300">•</span>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(submission.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSubmission(submission.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">
                {filterStatus === "all"
                  ? "No contact submissions yet"
                  : `No ${filterStatus} submissions`}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Contact form submissions will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-3 rounded-lg ${getStatusColor(
                    selectedSubmission.status
                  )}`}
                >
                  {getStatusIcon(selectedSubmission.status)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedSubmission.name}
                  </h2>
                  <p className="text-gray-600">{selectedSubmission.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                {formatDate(selectedSubmission.created_at)}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Subject
                </label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900">{selectedSubmission.subject}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Message
                </label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {selectedSubmission.message}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(selectedSubmission.id, "read")}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      selectedSubmission.status === "read"
                        ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Mark as Read
                  </button>
                  <button
                    onClick={() =>
                      updateStatus(selectedSubmission.id, "responded")
                    }
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      selectedSubmission.status === "responded"
                        ? "bg-green-100 text-green-700 border-2 border-green-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Mark as Responded
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <a
                  href={`mailto:${
                    selectedSubmission.email
                  }?subject=${encodeURIComponent(
                    "Re: " + selectedSubmission.subject
                  )}`}
                  className="w-full gradient-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
