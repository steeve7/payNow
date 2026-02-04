"use client";

import { useState, useMemo } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  setNetworkProvider,
  setSelectedPlan,
  fetchDataPlans,
  setSubmitting,
  setAmount,
  setPhoneNumber,
} from "@/redux/slices/billSlice";
import PayNowButton from "../button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

const NETWORKS = [
  { id: "mtn", label: "MTN" },
  { id: "airtel", label: "Airtel" },
  { id: "glo", label: "Glo" },
  { id: "9mobile", label: "9mobile" },
];

function normalizePhone(raw: string) {
  return String(raw || "")
    .replace(/\D/g, "")
    .trim();
}

export default function DataSection() {
  const dispatch = useAppDispatch();

  const [showPlans, setShowPlans] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("");

  const [error, setError] = useState<string | null>(null);

  const {
    networkProvider,
    selectedPlan,
    dataPlans,
    dataPlansLoading,
    dataPlansError,
    isSubmitting,
    amount,
    phoneNumber,
  } = useAppSelector((state) => state.bill);

  const handleNetworkSelect = (network: string) => {
    setError(null);
    dispatch(setNetworkProvider(network));
    dispatch(fetchDataPlans(network));
    setShowPlans(false);
  };

  const handlePlanSelect = (plan: any) => {
    setError(null);
    dispatch(setSelectedPlan(plan.id)); // variation_code
    dispatch(setAmount(String(plan.amount || "")));
    setShowPlans(false);
  };

  const selectedPlanObj = useMemo(() => {
    if (!selectedPlan) return null;
    return dataPlans.find((p) => String(p.id) === String(selectedPlan)) || null;
  }, [selectedPlan, dataPlans]);

  const handleContinuePayment = async () => {
    setError(null);

    if (!networkProvider) return setError("Please select a network.");
    if (!selectedPlan) return setError("Please select a data plan.");
    if (!phoneNumber) return setError("Please enter a phone number.");
    if (!amount) return setError("Amount is missing.");
    if (!selectedGateway) return setError("Please select a payment gateway.");

    const serviceID = selectedPlanObj?.serviceID;
    if (!serviceID) {
      return setError(
        "Missing serviceID for this plan. Reload plans and select again."
      );
    }

    const phone = normalizePhone(phoneNumber);
    if (!phone || phone.length < 10) {
      return setError("Please enter a valid phone number.");
    }

    dispatch(setSubmitting(true));

    try {
      // session optional
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
          billType: "data",
          gateway: selectedGateway,

          // paid amount (what you charge)
          amount: Number(amount),

          // phone identity
          customer_phone: phone,

          // keep data fields top-level (your initiate merges + normalizes)
          phone,
          network: networkProvider,
          serviceID,
          planId: selectedPlan,
          plan_code: selectedPlan,
          ck_plan_code: selectedPlanObj?.ck_plan_code || "",
          plan_name: selectedPlanObj?.name || "",
          validity: selectedPlanObj?.validity || "—",

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
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok) throw new Error(out?.error || "Payment init failed");

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

      throw new Error("No redirect/form returned from server.");
    } catch (e: any) {
      setError(e?.message || "Payment failed");
    } finally {
      dispatch(setSubmitting(false));
      setOpenModal(false);
    }
  };

  const disablePay =
    !networkProvider ||
    !selectedPlan ||
    !normalizePhone(phoneNumber) ||
    !amount ||
    isSubmitting;

  return (
    <div className="space-y-6">
      {/* Network */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Select Network
        </label>
        <div className="grid grid-cols-4 gap-3">
          {NETWORKS.map((net) => (
            <button
              key={net.id}
              onClick={() => handleNetworkSelect(net.id)}
              className={`p-3 rounded-xl text-sm border transition
                ${
                  networkProvider === net.id
                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-200 text-blue-500"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              type="button"
            >
              {net.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Phone Number
        </label>
        <input
          type="tel"
          placeholder="e.g., 08012345678"
          value={phoneNumber || ""}
          onChange={(e) => dispatch(setPhoneNumber(e.target.value))}
          className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Plan Dropdown */}
      {networkProvider && (
        <div className="relative">
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Select Data Plan
          </label>

          <button
            type="button"
            onClick={() => setShowPlans((prev) => !prev)}
            className="w-full flex justify-between items-center p-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-300"
          >
            <span className="text-sm text-gray-700">
              {selectedPlanObj
                ? `${selectedPlanObj.name} - ₦${Number(
                    selectedPlanObj.amount
                  ).toLocaleString()}`
                : "Choose a data plan"}
            </span>
            <FaChevronDown />
          </button>

          {showPlans && (
            <div className="absolute z-10 mt-2 w-full bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {dataPlansLoading && (
                <p className="p-3 text-sm text-gray-500">Loading plans...</p>
              )}

              {!dataPlansLoading && dataPlansError && (
                <p className="p-3 text-sm text-red-600">{dataPlansError}</p>
              )}

              {!dataPlansLoading &&
                !dataPlansError &&
                dataPlans.map((plan) => (
                  <button
                    key={`${plan.id}-${plan.amount}`}
                    onClick={() => handlePlanSelect(plan)}
                    className="w-full text-left p-3 text-sm hover:bg-blue-50 transition"
                    type="button"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">{plan.name}</span>
                      <span className="text-gray-600 font-medium">
                        ₦{Number(plan.amount).toLocaleString()}
                      </span>
                    </div>
                    {plan.validity ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {plan.validity}
                      </p>
                    ) : null}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Amount
        </label>
        <input
          type="text"
          value={amount || ""}
          placeholder="₦ 0.00"
          readOnly
          className="w-full p-3 border rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {(error || dataPlansError) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error || dataPlansError}
        </p>
      )}

      <PayNowButton
        onClick={() => {
          setError(null);
          setOpenModal(true);
        }}
        disabled={disablePay}
        loading={isSubmitting}
        allowGuest={true}
      />

      <PaymentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        amount={amount}
        loading={isSubmitting}
        selectedGateway={selectedGateway}
        setSelectedGateway={setSelectedGateway}
        onContinue={handleContinuePayment}
      />
    </div>
  );
}
