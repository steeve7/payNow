"use client";

import React from "react";
import { Receipt, Eye, Download } from "lucide-react";
import type { PaymentRow } from "../types";
import {
  formatDate,
  getAccountDisplay,
  getBillTypeLabel,
  normalizeStatus,
} from "../utilis/formatters";
import { pillClasses } from "./receiptUIHelpers";

export default function TransactionItem({
  tx,
  isDownloading,
  onView,
  onDownload,
}: {
  tx: PaymentRow;
  isDownloading: boolean;
  onView: (tx: PaymentRow) => void;
  onDownload: (tx: PaymentRow) => void;
}) {
  return (
    <div
      className="
        border border-gray-200 rounded-2xl
        hover:border-primary-300 hover:bg-gray-50 transition-all
        p-3 sm:p-4
      "
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Receipt className="w-6 h-6 text-primary-600" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
              {getBillTypeLabel(tx.bill_type)}
            </h4>

            <span
              className={`px-2 py-0.5 text-[11px] sm:text-xs rounded-full font-medium ${pillClasses(
                tx.status
              )}`}
            >
              {normalizeStatus(tx.status)}
            </span>

            {tx.vend_status ? (
              <span
                className={`px-2 py-0.5 text-[11px] sm:text-xs rounded-full font-medium ${pillClasses(
                  String(tx.vend_status)
                )}`}
                title={
                  tx.vend_last_error
                    ? `Vend error: ${tx.vend_last_error}`
                    : "Vending status"
                }
              >
                vend: {normalizeStatus(tx.vend_status)}
              </span>
            ) : null}
          </div>

          <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
            {getAccountDisplay(tx)} • {formatDate(tx.created_at)}
          </p>

          <p className="text-[11px] sm:text-xs text-gray-500 font-mono mt-1 break-all">
            {tx.reference}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start sm:gap-4">
          <p className="text-base sm:text-lg font-bold text-gray-900">
            ₦{Number(tx.amount || 0).toLocaleString()}
          </p>
          <p className="text-[11px] sm:text-xs text-gray-500">
            {tx.gateway ? String(tx.gateway).toUpperCase() : "—"}
          </p>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onView(tx)}
            className="px-3 py-2 sm:p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors flex items-center gap-2"
            type="button"
          >
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:hidden">View</span>
          </button>

          <button
            onClick={() => onDownload(tx)}
            disabled={isDownloading}
            className="px-3 py-2 sm:p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            type="button"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:hidden">
              {isDownloading ? "..." : "PDF"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
