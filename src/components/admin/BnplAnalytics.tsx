import { useEffect, useState } from "react";
import { TrendingUp, Users, MousePointerClick, UserCheck } from "lucide-react";

interface BnplAnalyticsProps {
  timeFilter: string;
  customStart?: string;
  customEnd?: string;
}

interface BnplData {
  totalClicks: number;
  authenticatedUsers: number;
  nonAuthenticatedClicks: number;
  uniqueUsers: number;
  clicksOverTime: Array<{
    date: string;
    clicks: number;
    unique_users: number;
  }>;
}

export default function BnplAnalytics({
  timeFilter,
  customStart,
  customEnd,
}: BnplAnalyticsProps) {
  const [data, setData] = useState<BnplData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let url = `/api/admin/analytics/bnpl-clicks?filter=${timeFilter}`;
        if (timeFilter === "custom" && customStart && customEnd) {
          url += `&start=${customStart}&end=${customEnd}`;
        }

        const response = await fetch(url, {
          credentials: "include",
        });
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching BNPL analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeFilter, customStart, customEnd]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const conversionRate =
    data.totalClicks > 0
      ? ((data.authenticatedUsers / data.totalClicks) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Buy Now Pay Later - Interest Tracking
        </h3>
        <p className="text-sm text-gray-600">
          Track user interest in the BNPL feature to validate the idea
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Total Clicks
            </span>
            <MousePointerClick className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.totalClicks.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">All BNPL button clicks</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Authenticated
            </span>
            <UserCheck className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.authenticatedUsers.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Logged in users</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Anonymous</span>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.nonAuthenticatedClicks.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Guest clicks</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Interest Rate
            </span>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            Auth users / total clicks
          </p>
        </div>
      </div>

      {data.clicksOverTime && data.clicksOverTime.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Click Trend
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">
                    Clicks
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">
                    Unique Users
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.clicksOverTime.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3 text-gray-600">{row.date}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">
                      {row.clicks}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {row.unique_users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
