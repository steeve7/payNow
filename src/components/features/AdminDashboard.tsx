"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  CheckCircle,
  Loader2,
  Lock,
  MessageSquare,
} from "lucide-react";

import MetricsOverview from "@/components/admin/MetricsOverview";
import EngagementChart from "@/components/admin/EngagementChart";
import RevenueChart from "@/components/admin/RevenueChart";
import RetentionChart from "@/components/admin/RetentionChart";
import ReliabilityChart from "@/components/admin/ReliabilityChart";
import RecentTransactions from "@/components/admin/RecentTransactions";
import TimeFilter from "@/components/admin/TimeFilter";
import BillTypeFilter from "@/components/admin/BillTypeFilter";
import UserAnalytics from "@/components/admin/UserAnalytics";
import BillTypeAnalytics from "@/components/admin/BillTypeAnalytics";
import BnplAnalytics from "@/components/admin/BnplAnalytics";
import BlogAnalytics from "@/components/admin/BlogAnalytics";

import { useSupabaseAuth } from "@/redux/hooks/useSupabaseAuth";
import {
  selectAdminFilters,
  selectAdminOverview,
  setAdminBillTypeFilter,
  setAdminOverview,
  setAdminTimeFilter,
} from "@/redux/slices/billSlice";

type AdminRole = string;

export default function AdminDashboard() {
  const router = useRouter();
  const dispatch = useDispatch();

  // we don’t rely on user for redirects (server session is source of truth)
  const { loading } = useSupabaseAuth();

  const adminFilters = useSelector(selectAdminFilters);
  const overview = useSelector(selectAdminOverview);

  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // --- Admin management (super_admin only) ---
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");

  const [newAdmin, setNewAdmin] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "manager",
    email_confirm: true,
  });

  // ---- helpers ----
  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fetchMeWithRetry = async () => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch("/api/users/me?t=" + Date.now(), {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) return res.json();

      if (res.status === 401) {
        await sleep(350);
        continue;
      }

      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || "Failed /api/users/me");
    }

    throw new Error("Unauthorized");
  };

  // Fetch role + metrics
  useEffect(() => {
    const run = async () => {
      if (loading) return;

      setPageLoading(true);

      try {
        const me = await fetchMeWithRetry();

        const roleRaw = me?.adminRole ?? me?.role ?? null;
        const role =
          typeof roleRaw === "string" ? roleRaw.replace(/\s+/g, "_") : null;

        setAdminRole(role);

        // role routing
        if (role === "customer_support") {
          router.replace("/admin/contact-submissions");
          return;
        }
        if (role === "blog_manager") {
          router.replace("/admin/blog-management");
          return;
        }
        if (role !== "super_admin" && role !== "manager") {
          router.replace("/pay-bills");
          return;
        }

        // Overview metrics fetch WITH FILTERS
        const qs = new URLSearchParams({
          timeFilter: adminFilters.timeFilter,
          billType: adminFilters.billTypeFilter,
          start: adminFilters.customStart ?? "",
          end: adminFilters.customEnd ?? "",
        });

        const metricsRes = await fetch(
          `/api/admin/metrics/overview?${qs.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (metricsRes.ok) {
          const data = await metricsRes.json();
          dispatch(setAdminOverview(data));
        } else {
          dispatch(setAdminOverview(null));
        }
      } catch (e) {
        console.error("AdminDashboard load error:", e);
        router.replace("/signin");
      } finally {
        setPageLoading(false);
      }
    };

    run();
  }, [
    loading,
    router,
    dispatch,
    adminFilters.timeFilter,
    adminFilters.billTypeFilter,
    adminFilters.customStart,
    adminFilters.customEnd,
  ]);

  // load admins list once role is known
  useEffect(() => {
    if (adminRole === "super_admin") loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRole]);

  const handleTimeFilterChange = (
    filter: string,
    start?: string,
    end?: string
  ) => {
    dispatch(setAdminTimeFilter({ filter: filter as any, start, end }));
  };

  const canManageAdmins = adminRole === "super_admin";

  const loadAdmins = async () => {
    setAdminError("");
    setAdminsLoading(true);

    try {
      const res = await fetch("/api/admin/admin-users", {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAdminError(json?.error || "Failed to load admins");
        setAdmins([]);
        return;
      }

      setAdmins(Array.isArray(json?.admins) ? json.admins : []);
    } catch (e: any) {
      setAdminError(e?.message || "Failed to load admins");
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!newAdmin.email || !newAdmin.password || !newAdmin.role) {
      setAdminError("Email, password and role are required.");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await fetch("/api/admin/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: newAdmin.email.trim().toLowerCase(),
          password: newAdmin.password,
          full_name: newAdmin.full_name?.trim() || undefined,
          phone: newAdmin.phone?.trim() || undefined,
          role: newAdmin.role,
          email_confirm: Boolean(newAdmin.email_confirm),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAdminError(json?.error || "Failed to create admin");
        return;
      }

      setAdminSuccess("Admin created successfully.");
      setNewAdmin({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "manager",
        email_confirm: true,
      });

      await loadAdmins();
    } catch (e: any) {
      setAdminError(e?.message || "Failed to create admin");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!adminRole || (adminRole !== "super_admin" && adminRole !== "manager")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">
                Monitor your product metrics and performance
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/admin/contact-submissions")}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Contact Submissions
              </button>

              <TimeFilter
                value={adminFilters.timeFilter}
                onFilterChange={handleTimeFilterChange}
              />

              <BillTypeFilter
                value={adminFilters.billTypeFilter}
                onFilterChange={(val: string) =>
                  dispatch(setAdminBillTypeFilter(val))
                }
              />
            </div>
          </div>
        </div>

        {/* Admin Management (super_admin only) */}
        {canManageAdmins && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Admin Management
                </h2>
                <p className="text-sm text-gray-600">
                  Create and view admin accounts
                </p>
              </div>

              <button
                type="button"
                onClick={loadAdmins}
                disabled={adminsLoading}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {adminsLoading ? "Refreshing..." : "Refresh list"}
              </button>
            </div>

            {adminError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {adminError}
              </div>
            )}

            {adminSuccess && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {adminSuccess}
              </div>
            )}

            {/* Create Admin Form */}
            <form
              onSubmit={handleCreateAdmin}
              className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6"
            >
              <input
                className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 md:col-span-2"
                placeholder="Email"
                value={newAdmin.email}
                onChange={(e) =>
                  setNewAdmin((s) => ({ ...s, email: e.target.value }))
                }
                required
              />

              <input
                className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 md:col-span-1"
                placeholder="Password"
                value={newAdmin.password}
                onChange={(e) =>
                  setNewAdmin((s) => ({ ...s, password: e.target.value }))
                }
                required
              />

              <input
                className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 md:col-span-1"
                placeholder="Full name"
                value={newAdmin.full_name}
                onChange={(e) =>
                  setNewAdmin((s) => ({ ...s, full_name: e.target.value }))
                }
              />

              <input
                className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 md:col-span-1"
                placeholder="Phone"
                value={newAdmin.phone}
                onChange={(e) =>
                  setNewAdmin((s) => ({ ...s, phone: e.target.value }))
                }
              />

              <select
                className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 md:col-span-1"
                value={newAdmin.role}
                onChange={(e) =>
                  setNewAdmin((s) => ({ ...s, role: e.target.value }))
                }
              >
                <option value="manager">manager</option>
                <option value="customer_support">customer_support</option>
                <option value="blog_manager">blog_manager</option>
                <option value="super_admin">super_admin</option>
              </select>

              <div className="md:col-span-6 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newAdmin.email_confirm}
                    onChange={(e) =>
                      setNewAdmin((s) => ({
                        ...s,
                        email_confirm: e.target.checked,
                      }))
                    }
                  />
                  Auto-confirm email
                </label>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  {createLoading ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </form>

            {/* Admins Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 px-3 font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-700">
                      Phone
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-700">
                      Role
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-700">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td className="py-4 px-3 text-gray-500" colSpan={5}>
                        No admins found.
                      </td>
                    </tr>
                  ) : (
                    admins.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 font-medium text-gray-900">
                          {a.email}
                        </td>
                        <td className="py-2 px-3 text-gray-700">
                          {a.full_name || "-"}
                        </td>
                        <td className="py-2 px-3 text-gray-700">
                          {a.phone || "-"}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                            {a.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {a.created_at
                            ? new Date(a.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* NSM */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-primary-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary-600" />
                </div>
                <span className="text-sm font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                  NSM
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                {safeNumber(overview?.nsm).toFixed(2)}
              </p>

              <p className="text-sm text-gray-600">
                Transactions per Active User
              </p>
            </div>

            {/* Reliability */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  Reliability
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                {safeNumber(overview?.successRate).toFixed(1)}%
              </p>

              <p className="text-sm text-gray-600">Transaction Success Rate</p>
            </div>

            {/* Revenue */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  Revenue
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                ₦{safeNumber(overview?.revenuePerTransaction).toFixed(2)}
              </p>

              <p className="text-sm text-gray-600">Revenue per Transaction</p>
            </div>

            {/* Active Users */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Users
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                {safeNumber(overview?.activeUsers).toLocaleString()}
              </p>

              <p className="text-sm text-gray-600">Active Users</p>
            </div>

            {/* Total Successful */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-amber-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <img
                    src="https://mocha-cdn.com/019aa842-cd89-7a58-8535-534d63b3bcf1/Untitled-design-(31).png"
                    alt="Transactions"
                    className="w-8 h-8"
                  />
                </div>
                <span className="text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  Transactions
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                {safeNumber(overview?.totalTransactions).toLocaleString()}
              </p>

              <p className="text-sm text-gray-600">Total Successful</p>
            </div>

            {/* Total Revenue */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  Total
                </span>
              </div>

              <p className="text-3xl font-bold text-gray-900 mb-1">
                ₦{safeNumber(overview?.totalRevenue).toLocaleString()}
              </p>

              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="mb-8">
          <UserAnalytics
            timeFilter={adminFilters.timeFilter}
            customStart={adminFilters.customStart}
            customEnd={adminFilters.customEnd}
          />
        </div>

        <div className="mb-8">
          <BillTypeAnalytics
            timeFilter={adminFilters.timeFilter}
            billTypeFilter={adminFilters.billTypeFilter}
            customStart={adminFilters.customStart}
            customEnd={adminFilters.customEnd}
          />
        </div>

        <div className="mb-8">
          <BnplAnalytics
            timeFilter={adminFilters.timeFilter}
            customStart={adminFilters.customStart}
            customEnd={adminFilters.customEnd}
          />
        </div>

        <div className="mb-8">
          <BlogAnalytics />
        </div>

        <div className="space-y-8">
          <MetricsOverview />
          <EngagementChart />
          <RevenueChart />
          <RetentionChart />
          <ReliabilityChart />
          <RecentTransactions />
        </div>
      </div>
    </div>
  );
}
