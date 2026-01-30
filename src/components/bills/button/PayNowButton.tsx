"use client";

import { FiArrowRight } from "react-icons/fi";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PayNowButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  label?: string;

  billType?: string;
  amount?: number;
  meta?: any;

  onOpen?: () => void;
  onClick?: () => void;
};

export default function PayNowButton({
  onClick,
  onOpen,
  disabled = false,
  loading = false,
  label = "Pay Now",
}: PayNowButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handle = async () => {
    // 1) Confirm auth state
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    // 2) If not logged in, go to signin with return URL
    if (!user) {
      const next = encodeURIComponent(pathname || "/pay-bills");
      router.push(`/signin?next=${next}`);
      return;
    }

    // 3) Logged in => continue normal flow
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
