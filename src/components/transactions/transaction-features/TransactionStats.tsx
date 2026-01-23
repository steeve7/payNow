"use client";

import React from "react";
import { Receipt, Zap, Calendar } from "lucide-react";
import type { TransactionStats as Stats } from "../types";

export default function TransactionStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl p-4 sm:p-6 border border-primary-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-600">
              Total Transactions
            </p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {stats.totalTransactions}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 sm:p-6 border border-green-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-600">Total Spent</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              ₦{stats.totalSpent.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 sm:p-6 border border-orange-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-gray-600">Last Payment</p>
            <p className="text-sm font-semibold text-gray-900">
              {stats.mostRecentTransaction
                ? new Date(
                    stats.mostRecentTransaction.created_at
                  ).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
