"use client";

import React from "react";
import { Filter } from "lucide-react";
import { FILTERS } from "../utilis/formatters";

export default function TransactionHeader({
  filterType,
  setFilterType,
}: {
  filterType: string;
  setFilterType: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
          Transaction History
        </h3>
        <p className="text-gray-600 text-xs sm:text-sm mt-1">
          View and download your payment receipts
        </p>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full sm:w-[220px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
