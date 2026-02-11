"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PayNowButton from "@/components/bills/button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";
import {
  setNetworkProvider,
  setAmount,
  setPhoneNumber,
  setShowPaymentModal,
} from "@/redux/slices/billSlice";
import type { RootState } from "@/redux/store";

const NETWORKS = [
  { id: "mtn", label: "MTN" },
  { id: "airtel", label: "Airtel" },
  { id: "glo", label: "Glo" },
  { id: "9mobile", label: "9mobile" },
] as const;

function normalizePhone(raw: string) {
  return String(raw || "").replace(/\D/g, "").trim();
}

export default function AirtimeSection() {
  const dispatch = useDispatch();

  const { networkProvider, amount, phoneNumber, showPaymentModal } =
    useSelector((state: RootState) => state.bill);

  // default to paystack (PaymentModal will also enforce)
  const [selectedGateway, setSelectedGateway] = useState<string>("paystack");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const canPay =
    !!networkProvider &&
    !!amount &&
    !!normalizePhone(phoneNumber) &&
    Number(amount) > 0;

  const onPayNow = () => {
    setError("");
    const p = normalizePhone(phoneNumber);

    if (!networkProvider) return setError("Please select a network.");
    if (!p) return setError("Please enter a phone number.");
    if (!amount || Number(amount) < 50)
      return setError("Enter a valid amount (min ₦50).");

    dispatch(setShowPaymentModal(true));
  };

  const onCloseModal = () => {
    dispatch(setShowPaymentModal(false));
  };

  const onContinue = async () => {
    setError("");

    if (!networkProvider) return setError("Please select a network.");
    const phone = normalizePhone(phoneNumber);
    if (!phone) return setError("Please enter a phone number.");
    if (!amount || Number(amount) <= 0)
      return setError("Please enter a valid amount.");

    // only allow paystack or seerbit now
    if (!selectedGateway) return setError("Please select a payment gateway.");
    if (!["paystack", "seerbit"].includes(selectedGateway)) {
      return setError("Selected gateway is not supported.");
    }

    setLoading(true);

    try {
      // Optional session (guest allowed)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          billType: "airtime",
          gateway: selectedGateway, // paystack | seerbit
          amount: Number(amount),

          // phone identity
          customer_phone: phone,

          payload: {
            phone,
            network: networkProvider,
            // NOTE: initiate route will FORCE this to paidAmount anyway
            amount: Number(amount),
          },

          meta: {
            guest: !session?.user,
          },
        }),
      });

      const raw = await res.text();
      let out: any = null;

      try {
        out = JSON.parse(raw);
      } catch {
        console.warn("Non-JSON response from /api/payments/initiate:", raw);
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok) {
        console.warn("Initiate error:", out);
        throw new Error(out?.error || "Payment init failed");
      }

      if (out?.type === "redirect" && out?.redirectUrl) {
        window.location.href = out.redirectUrl;
        return;
      }

      console.warn("Unexpected initiate response:", out);
      throw new Error("No redirect returned from server.");
    } catch (e: any) {
      console.warn("Payment failed:", e);
      setError(e?.message || "Payment failed");
    } finally {
      setLoading(false);
      dispatch(setShowPaymentModal(false));
    }
  };

  return (
    <div className="space-y-6">
      {/* Network */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Network
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NETWORKS.map((net) => (
            <button
              key={net.id}
              onClick={() => dispatch(setNetworkProvider(net.id))}
              type="button"
              className={`p-3 rounded-xl text-sm border transition ${
                networkProvider === net.id
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-200 text-blue-500"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              {net.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => dispatch(setPhoneNumber(e.target.value))}
          placeholder="080xxxxxxxx"
          className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => dispatch(setAmount(e.target.value))}
          placeholder="Enter amount"
          className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[100, 200, 500, 1000].map((amt) => (
            <button
              key={amt}
              onClick={() => dispatch(setAmount(String(amt)))}
              type="button"
              className="p-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200"
            >
              ₦{amt}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <PayNowButton
        onClick={onPayNow}
        disabled={!canPay}
        loading={loading}
        allowGuest={true}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={onCloseModal}
        amount={amount}
        title="Choose Payment Method"
        loading={loading}
        selectedGateway={selectedGateway}
        setSelectedGateway={setSelectedGateway}
        onContinue={onContinue}
      />
    </div>
  );
}
