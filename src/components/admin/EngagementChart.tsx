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
import { Activity } from "lucide-react";

interface EngagementData {
  month: string;
  avgTransactionsPerUser: number;
  activeUsers: number;
  totalTransactions: number;
}

export default function EngagementChart() {
  const [data, setData] = useState<EngagementData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/metrics/engagement", {
          credentials: "include",
        });
        if (response.ok) {
          const engagementData = await response.json();
          setData(engagementData.reverse());
        }
      } catch (error) {
        console.error("Error fetching engagement metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const avgEngagement =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.avgTransactionsPerUser, 0) / data.length
      : 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Engagement Metrics
            </h3>
            <p className="text-sm text-gray-600">
              Transactions per user per month
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">
            {avgEngagement.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Avg Transactions/User</p>
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
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
              dataKey="avgTransactionsPerUser"
              fill="#6366f1"
              name="Avg Transactions per User"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No engagement data available yet
        </div>
      )}
    </div>
  );
}
