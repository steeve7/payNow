"use client";

import React, { forwardRef } from "react";
import type { PaymentRow } from "../types";
import { buildReceiptRows } from "../utilis/receiptBuilder";
import { PAYNOW_LOGO_SRC, pillClasses } from "./receiptUIHelpers";

export const ReceiptPaper = forwardRef<
  HTMLDivElement,
  { tx: PaymentRow; variant?: "print" | "view" }
>(function ReceiptPaper({ tx, variant = "print" }, ref) {
  const rows = buildReceiptRows(tx);

  const isView = variant === "view";

  return (
    <div
      ref={ref}
      className={[
        //  base (shared)
        "w-full bg-white border border-gray-200 overflow-hidden",
        //  print/pdf stays like before
        !isView ? "max-w-2xl mx-auto rounded-2xl" : "",
        //  view: take full modal width, smaller radius on tiny screens
        isView ? "max-w-none rounded-xl sm:rounded-2xl" : "",
      ].join(" ")}
    >
      {/* Header */}
      <div
        className={
          isView
            ? "px-4 sm:px-6 pt-5 pb-4 text-center"
            : "px-6 pt-6 pb-4 text-center"
        }
      >
        <div className="flex justify-center items-center gap-2 flex-wrap">
          <img
            src={PAYNOW_LOGO_SRC}
            alt="PayNow"
            crossOrigin="anonymous"
            className="h-10 w-auto"
            style={{ objectFit: "contain", display: "block" }}
          />
          <span className="text-lg sm:text-xl font-extrabold text-blue-600">
            PayNow
          </span>
        </div>

        <div className="mt-3 text-lg sm:text-xl font-extrabold text-gray-900">
          Transaction Summary
        </div>
      </div>

      {/* Body */}
      <div className={isView ? "px-4 sm:px-6 pb-5" : "px-6 pb-6"}>
        <div
          className={
            isView
              ? "border border-gray-200 rounded-2xl p-4 sm:p-5"
              : "mt-6 border border-gray-200 rounded-2xl p-5"
          }
        >
          {rows.map((r) => (
            <ReceiptRow
              key={r.label}
              label={r.label}
              value={r.value}
              mono={r.mono}
              pill={r.pill}
              variant={variant}
            />
          ))}
        </div>

        <div
          className={
            isView
              ? "text-center text-xs text-gray-500 mt-4"
              : "text-center text-xs text-gray-500 mt-6"
          }
        >
          Thank you for using PayNow.
        </div>
      </div>
    </div>
  );
});

function ReceiptRow({
  label,
  value,
  mono,
  pill,
  variant = "print",
}: {
  label: string;
  value: string;
  mono?: boolean;
  pill?: boolean;
  variant?: "print" | "view";
}) {
  const isView = variant === "view";

  return (
    <div className="py-2 border-b border-dashed border-gray-200 last:border-b-0">
      {/* VIEW: stack on mobile, align on desktop */}
      <div
        className={
          isView
            ? "flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4"
            : "flex justify-between gap-4"
        }
      >
        <span
          className={
            isView
              ? "text-gray-600 text-xs sm:text-sm"
              : "text-gray-600 text-sm"
          }
        >
          {label}
        </span>

        {pill ? (
          <span
            className={[
              "px-3 py-1 rounded-full text-xs font-bold capitalize",
              pillClasses(value),
              isView ? "self-start sm:self-auto" : "",
            ].join(" ")}
          >
            {value}
          </span>
        ) : (
          <span
            className={[
              // view: keep readable and prevent overflow
              isView
                ? "text-left sm:text-right text-sm font-semibold text-gray-900 break-words"
                : "text-right text-sm font-semibold text-gray-900",
              mono ? "font-mono text-[#4338ca] font-extrabold break-all" : "",
            ].join(" ")}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
