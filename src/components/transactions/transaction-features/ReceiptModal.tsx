"use client";

import React from "react";
import type { PaymentRow } from "../types";
import { Download } from "lucide-react";
import { buildReceiptRows } from "../utilis/receiptBuilder";
import { PAYNOW_LOGO_SRC, PAYNOW_WORDMARK_SRC } from "../utilis/formatters";
import { pillClasses } from "./receiptUIHelpers";

function ReceiptRow({
  label,
  value,
  mono,
  pill,
}: {
  label: string;
  value: string;
  mono?: boolean;
  pill?: boolean;
}) {
  return (
    <div className="py-2 border-b border-dashed border-gray-200 last:border-b-0">
      {/* Responsive: stack on mobile, align on sm+ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
        <span className="text-gray-600 text-xs sm:text-sm">{label}</span>

        {pill ? (
          <span
            className={[
              "px-3 py-1 rounded-full text-xs font-bold capitalize",
              pillClasses(value),
              "self-start sm:self-auto",
            ].join(" ")}
          >
            {value}
          </span>
        ) : (
          <span
            className={[
              // Left on mobile for readability, right on sm+
              "text-sm font-semibold text-gray-900 break-words",
              "text-left sm:text-right",
              mono ? "font-mono text-[#4338ca] font-extrabold break-all" : "",
            ].join(" ")}
          >
            {value || "—"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReceiptModal({
  open,
  tx,
  isDownloading,
  onClose,
  onDownload,
}: {
  open: boolean;
  tx: PaymentRow | null;
  isDownloading: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  if (!open || !tx) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      {/*  Wider on bigger screens, full width on mobile */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg sm:max-w-2xl max-h-[85vh] overflow-hidden relative">
        {/*  Sticky header so X is always clickable */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 text-gray-400 hover:text-gray-600"
            type="button"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/*  Responsive padding + text sizes */}
          <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 text-center">
            <div className="flex justify-center items-center gap-2 flex-wrap">
              <img
                src={PAYNOW_LOGO_SRC}
                alt="PayNow"
                crossOrigin="anonymous"
                style={{
                  height: 40,
                  width: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <img
                src={PAYNOW_WORDMARK_SRC}
                alt="PayNow"
                style={{ height: 32, width: "auto", display: "block" }}
              />
            </div>

            <div className="mt-3 text-lg sm:text-xl font-extrabold text-gray-900">
              Transaction Summary
            </div>
          </div>
        </div>

        {/* Scrollable body (so modal never overflows screen) */}
        <div className="px-4 sm:px-6 pb-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          <div className="mt-5 border border-gray-200 rounded-2xl p-4 sm:p-5">
            {buildReceiptRows(tx).map((r) => (
              <ReceiptRow
                key={r.label}
                label={r.label}
                value={r.value}
                mono={r.mono}
                pill={r.pill}
              />
            ))}

            {tx.vend_last_error ? (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl p-3 mt-4 break-words">
                {tx.vend_last_error}
              </div>
            ) : null}
          </div>

          <div className="mt-5 sm:mt-6 flex gap-3">
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="flex-1 gradient-primary text-white px-4 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              type="button"
            >
              <Download className="w-5 h-5" />
              {isDownloading ? "Downloading..." : "Download Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
