"use client";

import { FiArrowRight } from "react-icons/fi";

type PayNowButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  label?: string;

  //  what you tried to pass
  billType?: string;
  amount?: number;
  meta?: any;

  //  open modal (your pattern)
  onOpen?: () => void;

  // optional old prop
  onClick?: () => void;
};

export default function PayNowButton({
  onClick,
  onOpen,
  disabled = false,
  loading = false,
  label = "Pay Now",
}: PayNowButtonProps) {
  const handle = () => {
    // prefer onOpen (open modal), fallback to onClick
    if (onOpen) return onOpen();
    if (onClick) return onClick();
  };

  return (
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
  );
}
