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
import { Shield } from "lucide-react";

interface ReliabilityData {
  date: string;
  successRate: number;
  total: number;
  successful: number;
}

export default function ReliabilityChart() {
  const [data, setData] = useState<ReliabilityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/metrics/reliability", {
          credentials: "include",
        });
        if (response.ok) {
          const reliabilityData = await response.json();
          setData(reliabilityData);
        }
      } catch (error) {
        console.error("Error fetching reliability metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ✅ IMPORTANT: type formatter from TooltipProps
  const percentFormatter: TooltipProps<number, string>["formatter"] = (
    value
  ) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return `${n.toFixed(1)}%`;
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

  const avgSuccessRate =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.successRate, 0) / data.length
      : 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Reliability Metrics
            </h3>
            <p className="text-sm text-gray-600">
              Transaction success rate over time
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">
            {avgSuccessRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">30-Day Avg Success Rate</p>
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "12px",
              }}
              formatter={percentFormatter}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="successRate"
              stroke="#10b981"
              strokeWidth={3}
              name="Success Rate (%)"
              dot={{ fill: "#10b981", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No reliability data available yet
        </div>
      )}
    </div>
  );
}
