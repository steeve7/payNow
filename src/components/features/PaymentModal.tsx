"use client";

import { X } from "lucide-react";

const GATEWAYS = [
  { id: "paystack", label: "Paystack" },
  { id: "flutterwave", label: "Flutterwave" },
  { id: "korapay", label: "Korapay" },
  { id: "interswitch", label: "Interswitch" },
];

export default function PaymentModal({
  open,
  onClose,
  amount,
  title = "Choose Payment Method",
  loading = false,
  selectedGateway,
  setSelectedGateway,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  amount: number | string;
  title?: string;
  loading?: boolean;
  selectedGateway: string;
  setSelectedGateway: (v: string) => void;
  onContinue: () => void;
}) {
  if (!open) return null;

  const canContinue = !!selectedGateway && !loading;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
      {/* overlay */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close modal overlay"
      />

      {/* modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">
              Amount:{" "}
              <span className="font-semibold">
                ₦{Number(amount || 0).toLocaleString()}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {GATEWAYS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGateway(g.id)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                  selectedGateway === g.id
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Processing..." : "Continue"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            You’ll be redirected to complete payment.
          </p>
        </div>
      </div>
    </div>
  );
}
