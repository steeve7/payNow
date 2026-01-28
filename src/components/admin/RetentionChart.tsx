import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from "recharts";
import { RefreshCw } from "lucide-react";

interface RetentionData {
  month: string;
  usersPaying: number;
  retentionRate: number;
}

export default function RetentionChart() {
  const [data, setData] = useState<RetentionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/metrics/retention", {
          credentials: "include",
        });
        if (response.ok) {
          const retentionData = await response.json();
          setData(retentionData.reverse());
        }
      } catch (error) {
        console.error("Error fetching retention metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const retentionFormatter: TooltipProps<number, string>["formatter"] = (
    value,
    name
  ) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    if (name === "retentionRate") return `${n.toFixed(1)}%`;
    return n.toLocaleString();
  };

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

  const avgRetention =
    data.length > 1
      ? data.slice(0, -1).reduce((sum, d) => sum + d.retentionRate, 0) /
        (data.length - 1)
      : 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Retention Metrics
            </h3>
            <p className="text-sm text-gray-600">
              Monthly electricity bill payers
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">
            {avgRetention.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">Avg Retention Rate</p>
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
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
              formatter={retentionFormatter}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="usersPaying"
              stroke="#10b981"
              strokeWidth={2}
              name="Users Paying"
              dot={{ fill: "#10b981", r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="retentionRate"
              stroke="#6366f1"
              strokeWidth={2}
              name="Retention Rate (%)"
              dot={{ fill: "#6366f1", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No retention data available yet
        </div>
      )}
    </div>
  );
}
