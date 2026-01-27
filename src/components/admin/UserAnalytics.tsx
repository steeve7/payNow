import { useEffect, useState } from "react";
import { Users, UserCheck, UserX } from "lucide-react";

interface UserAnalyticsProps {
  timeFilter: string;
  customStart?: string;
  customEnd?: string;
}

interface UserMetrics {
  totalUsers: number;
  authenticatedUsers: number;
  nonAuthenticatedUsers: number;
  newUsersInPeriod: number;
}

export default function UserAnalytics({
  timeFilter,
  customStart,
  customEnd,
}: UserAnalyticsProps) {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ filter: timeFilter });
        if (customStart) params.append("start", customStart);
        if (customEnd) params.append("end", customEnd);

        const response = await fetch(`/api/admin/analytics/users?${params}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Error fetching user analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeFilter, customStart, customEnd]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const authPercentage =
    metrics.totalUsers > 0
      ? ((metrics.authenticatedUsers / metrics.totalUsers) * 100).toFixed(1)
      : "0";

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">User Analytics</h3>
          <p className="text-sm text-gray-600">
            Total and authenticated user metrics
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {metrics.totalUsers.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Users</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <UserCheck className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {metrics.authenticatedUsers.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Authenticated</p>
          <p className="text-xs text-green-600 font-semibold mt-1">
            {authPercentage}% of total
          </p>
        </div>

        <div className="p-6 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <UserX className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {metrics.nonAuthenticatedUsers.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Non-Authenticated</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {metrics.newUsersInPeriod.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">New in Period</p>
        </div>
      </div>
    </div>
  );
}
