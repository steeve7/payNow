import { useEffect, useState } from "react";
import { UserPlus, TrendingUp } from "lucide-react";

interface ActivationData {
  totalUsers: number;
  successfulFirstPayments: number;
  activationRate: number;
}

export default function MetricsOverview() {
  const [activation, setActivation] = useState<ActivationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/metrics/activation", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setActivation(data);
        }
      } catch (error) {
        console.error("Error fetching activation metrics:", error);
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
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!activation) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Activation Metrics
          </h3>
          <p className="text-sm text-gray-600">First payment success rate</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="text-center p-6 bg-gradient-to-br from-primary-50 to-purple-50 rounded-xl">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-primary-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {activation.activationRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600">Activation Rate</p>
        </div>

        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {activation.totalUsers}
          </p>
          <p className="text-sm text-gray-600">Total Users</p>
        </div>

        <div className="text-center p-6 bg-gray-50 rounded-xl">
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {activation.successfulFirstPayments}
          </p>
          <p className="text-sm text-gray-600">Successful First Payments</p>
        </div>
      </div>
    </div>
  );
}
