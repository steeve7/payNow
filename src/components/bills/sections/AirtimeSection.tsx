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
  return String(raw || "")
    .replace(/\s+/g, "")
    .trim();
}

export default function AirtimeSection() {
  const dispatch = useDispatch();

  const { networkProvider, amount, phoneNumber, showPaymentModal } =
    useSelector((state: RootState) => state.bill);

  const [selectedGateway, setSelectedGateway] = useState<string>("");
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
  if (!phoneNumber) return setError("Please enter a phone number.");
  if (!amount || Number(amount) <= 0)
    return setError("Please enter a valid amount.");
  if (!selectedGateway) return setError("Please select a payment gateway.");

  setLoading(true);

  try {
    // get logged-in user + token
    const { data: u, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);

    const email = u?.user?.email;
    if (!email) throw new Error("You must be signed in to continue.");

    const { data: s, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw new Error(sessErr.message);

    const accessToken = s?.session?.access_token;
    if (!accessToken)
      throw new Error("Auth session missing. Please login again.");

    const res = await fetch("/api/payments/initiate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // GUARANTEED
      },
      body: JSON.stringify({
        billType: "airtime",
        gateway: selectedGateway,
        amount: Number(amount),
        email,
        meta: {
          phone: normalizePhone(phoneNumber),
          network: networkProvider,
          amount: Number(amount),
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

    if (out?.type === "form_post" && out?.actionUrl && out?.fields) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = out.actionUrl;

      Object.entries(out.fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      return;
    }

    if (out?.type === "redirect" && out?.redirectUrl) {
      window.location.href = out.redirectUrl;
      return;
    }

    console.warn("Unexpected initiate response:", out);
    throw new Error("No redirect/form returned from server.");
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
        <div className="grid grid-cols-4 gap-3">
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

        <div className="grid grid-cols-4 gap-3 mt-3">
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

      {/* Pay */}
      <PayNowButton onClick={onPayNow} disabled={!canPay} loading={loading} />

      {/* Modal */}
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
