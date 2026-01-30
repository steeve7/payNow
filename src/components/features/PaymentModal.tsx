"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

const GATEWAYS = [
  { id: "paystack", label: "Paystack", disabled: false },
  {
    id: "flutterwave",
    label: "Flutterwave",
    disabled: true,
    badge: "Coming soon",
  },
  { id: "korapay", label: "Korapay", disabled: true, badge: "Coming soon" },
  {
    id: "interswitch",
    label: "Interswitch",
    disabled: true,
    badge: "Coming soon",
  },
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
  const byId = useMemo(() => {
    const m = new Map<string, (typeof GATEWAYS)[number]>();
    GATEWAYS.forEach((g) => m.set(g.id, g));
    return m;
  }, []);

  useEffect(() => {
    if (!open) return;

    // if selected gateway is disabled or empty, default to paystack
    const current = byId.get(selectedGateway);
    if (!selectedGateway || current?.disabled) {
      setSelectedGateway("paystack");
    }
  }, [open, selectedGateway, setSelectedGateway, byId]);

  if (!open) return null;

  const selected = byId.get(selectedGateway);
  const isPaystack = selectedGateway === "paystack";
  const canContinue = isPaystack && !loading;

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
            {GATEWAYS.map((g) => {
              const active = selectedGateway === g.id;
              const disabled = !!g.disabled;

              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) setSelectedGateway(g.id);
                  }}
                  className={[
                    "relative rounded-xl border px-4 py-3 text-sm font-medium transition text-left",
                    disabled
                      ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-90"
                      : active
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700",
                  ].join(" ")}
                >
                  {/* badge */}
                  {disabled && (
                    <span className="absolute top-2 right-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200">
                      {g.badge || "Coming soon"}
                    </span>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span>{g.label}</span>
                  </div>

                  {disabled && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      Not available yet
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              // extra safety: only paystack continues
              if (selectedGateway !== "paystack") return;
              onContinue();
            }}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:hover:bg-indigo-600"
          >
            {loading ? "Processing..." : "Continue"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            You’ll be redirected to complete payment.
          </p>

          {!isPaystack && (
            <p className="text-xs text-center text-gray-500">
              Only <span className="font-semibold text-gray-700">Paystack</span>{" "}
              is available right now.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
