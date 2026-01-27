import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface BillTypeAnalyticsProps {
  timeFilter: string;
  billTypeFilter: string;
  customStart?: string;
  customEnd?: string;
}

interface BillStats {
  bill_type: string;
  transaction_count: number;
  total_revenue: number;
  avg_revenue: number;
  unique_users: number;
  success_rate: number;
}

export default function BillTypeAnalytics({
  timeFilter,
  billTypeFilter,
  customStart,
  customEnd,
}: BillTypeAnalyticsProps) {
  const [stats, setStats] = useState<BillStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          filter: timeFilter,
          billType: billTypeFilter,
        });
        if (customStart) params.append("start", customStart);
        if (customEnd) params.append("end", customEnd);

        const response = await fetch(
          `/api/admin/analytics/bill-types?${params}`,
          {
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching bill type analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeFilter, billTypeFilter, customStart, customEnd]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Bill Type Performance
            </h3>
            <p className="text-sm text-gray-600">
              Transaction and revenue breakdown by bill type
            </p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Bill Type Performance
          </h3>
          <p className="text-sm text-gray-600">
            Transaction and revenue breakdown by bill type
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.bill_type}
            className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl"
          >
            <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
              {stat.bill_type}
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {stat.transaction_count.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600 mb-2">Transactions</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Revenue:</span>
              <span className="font-semibold text-gray-900">
                ₦{stat.total_revenue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-600">Success:</span>
              <span className="font-semibold text-green-600">
                {stat.success_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-8">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">
          Transaction Volume Comparison
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="bill_type"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "12px",
              }}
            />
            <Legend />
            <Bar
              dataKey="transaction_count"
              fill="#6366f1"
              name="Transactions"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="unique_users"
              fill="#10b981"
              name="Unique Users"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
