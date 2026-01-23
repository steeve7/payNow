"use client";

import React from "react";
import type { PaymentRow } from "../types";
import TransactionItem from "./TransactionItem";
import { Receipt } from "lucide-react";
import { getBillTypeLabel } from "../utilis/formatters";

export default function TransactionList({
  transactions,
  filterType,
  isDownloading,
  onView,
  onDownload,
}: {
  transactions: PaymentRow[];
  filterType: string;
  isDownloading: boolean;
  onView: (tx: PaymentRow) => void;
  onDownload: (tx: PaymentRow) => void;
}) {
  if (!transactions.length) {
    return (
      <div className="text-center py-10 sm:py-12">
        <Receipt className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-base sm:text-lg font-medium">
          {filterType === "all"
            ? "No transactions yet"
            : `No ${getBillTypeLabel(filterType)} transactions`}
        </p>
        <p className="text-gray-400 text-sm mt-2">
          Your payment history will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((t) => (
        <TransactionItem
          key={t.id}
          tx={t}
          isDownloading={isDownloading}
          onView={onView}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
