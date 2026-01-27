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

  const { user, loading } = useSupabaseAuth();

  const adminFilters = useSelector(selectAdminFilters);
  const overview = useSelector(selectAdminOverview);

  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Fetch role + metrics
  useEffect(() => {
    const run = async () => {
      if (loading) return;

      if (!user) {
        router.replace("/");
        return;
      }

      try {
        // 1) Get my role from server (trusted)
        const meRes = await fetch("/api/users/me", { credentials: "include" });
        if (!meRes.ok) throw new Error("Failed to load /api/users/me");
        const me = await meRes.json();

        const role = me?.adminRole
          ? String(me.adminRole).replace(/\s+/g, "_")
          : null;
        setAdminRole(role);

        // 2) Role routing
        if (role === "customer_support") {
          router.replace("/admin/contact-submissions");
          return;
        }
        if (role === "blog_manager") {
          router.replace("/admin/blog-management");
          return;
        }
        if (role !== "super_admin" && role !== "manager") {
          router.replace("/");
          return;
        }

        // 3) Overview metrics fetch WITH FILTERS (this is the qs you asked about)
        const qs = new URLSearchParams({
          timeFilter: adminFilters.timeFilter,
          billType: adminFilters.billTypeFilter, //
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
        console.error(e);
        router.replace("/");
      } finally {
        setPageLoading(false);
      }
    };

    run();
    // Re-run when filters change so cards update
  }, [
    user,
    loading,
    router,
    dispatch,
    adminFilters.timeFilter,
    adminFilters.billTypeFilter,
    adminFilters.customStart,
    adminFilters.customEnd,
  ]);

  const handleTimeFilterChange = (
    filter: string,
    start?: string,
    end?: string
  ) => {
    dispatch(setAdminTimeFilter({ filter: filter as any, start, end }));
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

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                {overview.nsm.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">
                Transactions per Active User
              </p>
            </div>

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
                {overview.successRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Transaction Success Rate</p>
            </div>

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
                ₦{overview.revenuePerTransaction.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Revenue per Transaction</p>
            </div>

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
                {overview.activeUsers.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>

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
                {overview.totalTransactions.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Successful</p>
            </div>

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
                ₦{overview.totalRevenue.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
          </div>
        )}

        {/* Charts get the SAME filters from redux */}
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
