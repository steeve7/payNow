import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface Transaction {
  id: number;
  transaction_token: string;
  bill_type: string;
  amount: number;
  status: string;
  created_at: string;
  account_number: string;
}

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/admin/transactions?limit=20", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Recent Transactions
          </h3>
          <p className="text-sm text-gray-600">Latest payment activity</p>
        </div>
      </div>

      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Token
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Bill Type
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <span className="text-sm font-mono text-primary-600">
                      {txn.transaction_token}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-900 capitalize">
                      {txn.bill_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-gray-900">
                      ₦{txn.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        txn.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {txn.status === "success" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {txn.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">
                      {new Date(txn.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-gray-400">
          No transactions yet
        </div>
      )}
    </div>
  );
}
