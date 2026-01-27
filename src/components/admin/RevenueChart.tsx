import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { DollarSign } from 'lucide-react';

interface RevenueOverTime {
  month: string;
  transaction_count: number;
  total_revenue: number;
}

interface RevenueByType {
  bill_type: string;
  transaction_count: number;
  total_revenue: number;
  avg_revenue: number;
}

interface RevenueData {
  byType: RevenueByType[];
  overTime: RevenueOverTime[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function RevenueChart() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/metrics/revenue', {
          credentials: 'include'
        });
        if (response.ok) {
          const revenueData = await response.json();
          setData(revenueData);
        }
      } catch (error) {
        console.error('Error fetching revenue metrics:', error);
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

  if (!data) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Revenue Metrics</h3>
          <p className="text-sm text-gray-600">Revenue breakdown and trends</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Revenue Over Time */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Revenue Over Time</h4>
          {data.overTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                  formatter={(value: number) => `₦${value.toLocaleString()}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total_revenue" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  name="Total Revenue"
                  dot={{ fill: '#6366f1', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No revenue data available yet
            </div>
          )}
        </div>

        {/* Revenue By Bill Type */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Bill Type</h4>
          {data.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.byType as any}
                  dataKey="total_revenue"
                  nameKey="bill_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={false}
                  labelLine={false}
                >
                  {data.byType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No revenue breakdown available yet
            </div>
          )}
        </div>
      </div>

      {/* Bill Type Stats */}
      {data.byType.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          {data.byType.map((type, index) => (
            <div key={type.bill_type} className="p-4 bg-gray-50 rounded-xl">
              <div 
                className="w-3 h-3 rounded-full mb-2" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <p className="text-xs font-semibold text-gray-700 capitalize mb-1">
                {type.bill_type}
              </p>
              <p className="text-lg font-bold text-gray-900">
                ₦{type.avg_revenue.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Avg per transaction</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
