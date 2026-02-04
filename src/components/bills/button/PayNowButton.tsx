"use client";

import { FiArrowRight } from "react-icons/fi";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase"; // keep your import as-is

type PayNowButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  label?: string;

  billType?: string;
  amount?: number;
  meta?: any;

  onOpen?: () => void;
  onClick?: () => void;

  /**
   * If true, unauthenticated users can still proceed (guest checkout)
   * and we show the "Proceed to payout / Sign-in" modal.
   */
  allowGuest?: boolean;

  /**
   * Optional: customize modal title
   */
  guestModalTitle?: string;
};

export default function PayNowButton({
  onClick,
  onOpen,
  disabled = false,
  loading = false,
  label = "Pay Now",
  allowGuest = true,
  guestModalTitle = "Continue to Payment",
}: PayNowButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [showChoice, setShowChoice] = useState(false);

  const continueToPayment = () => {
    setShowChoice(false);
    if (onOpen) return onOpen();
    if (onClick) return onClick();
  };

  const goToSignin = () => {
    setShowChoice(false);
    const next = encodeURIComponent(pathname || "/pay-bills");
    router.push(`/signin?next=${next}`);
  };

  const handle = async () => {
    // 1) Confirm auth state
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    // 2) If logged in -> continue normal flow
    if (user) {
      return continueToPayment();
    }

    // 3) Not logged in
    if (!allowGuest) {
      return goToSignin();
    }

    // 4) Guest allowed -> show modal with options
    setShowChoice(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handle}
        disabled={disabled || loading}
        className="w-full mt-6 flex items-center justify-center gap-2 text-white rounded-xl disabled:opacity-50 transition"
        style={{
          padding: "16px",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
        }}
      >
        {loading ? (
          "Processing..."
        ) : (
          <>
            <span>{label}</span>
            <FiArrowRight size={18} />
          </>
        )}
      </button>

      {/* Guest choice modal */}
      {showChoice && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button
            type="button"
            onClick={() => setShowChoice(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Close overlay"
          />

          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5">
            <div className="mb-2">
              <h3 className="text-lg font-bold text-gray-900">
                {guestModalTitle}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                You can pay as a guest or sign in to track your transactions.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={continueToPayment}
                className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition"
              >
                Proceed to payout
              </button>

              <button
                type="button"
                onClick={goToSignin}
                className="w-full rounded-xl border border-gray-300 bg-white text-gray-800 py-3 font-medium hover:bg-gray-50 transition"
              >
                Sign-in
              </button>

              <button
                type="button"
                onClick={() => setShowChoice(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
