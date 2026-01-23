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

export default function DataSection() {
  const dispatch = useAppDispatch();

  const [showPlans, setShowPlans] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("");

  // local vending code holder
  // const [planCode, setPlanCode] = useState<string>("");
  // const [planName, setPlanName] = useState<string>("");

  // local UI error
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

  // plan.id is your variation_code (your API normalized it)
  dispatch(setSelectedPlan(plan.id));
  // setPlanCode(plan.id);

  //  amount comes from API
  dispatch(setAmount(String(plan.amount || "")));

  setShowPlans(false);
};




const selectedPlanObj = useMemo(() => {
  if (!selectedPlan) return null;
  return dataPlans.find((p) => String(p.id) === String(selectedPlan)) || null;
}, [selectedPlan, dataPlans]);


  // const handleContinuePayment = async () => {
  //   setError(null);

  //   if (!networkProvider) return setError("Please select a network.");
  //   if (!selectedPlan) return setError("Please select a data plan.");
  //   if (!planCode) return setError("Selected plan is missing plan code.");
  //   if (!phoneNumber) return setError("Please enter a phone number.");
  //   if (!amount) return setError("Amount is missing.");
  //   if (!selectedGateway) return setError("Please select a payment gateway.");

  //   // ✅ serviceID comes from the selected plan returned by API
  //   const serviceID = selectedPlanObj?.serviceID;
  //   if (!serviceID)
  //     return setError(
  //       "Missing serviceID for this plan. Reload plans and select again."
  //     );

  //   dispatch(setSubmitting(true));

  //   try {
  //     const { data: u, error: userErr } = await supabase.auth.getUser();
  //     if (userErr) throw new Error(userErr.message);

  //     const email = u?.user?.email;
  //     if (!email) throw new Error("You must be signed in to continue.");

  //     const res = await fetch("/api/payments/initiate", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         billType: "data",
  //         gateway: selectedGateway,
  //         amount: Number(amount),
  //         email,
  //         meta: {
  //           phone: phoneNumber,
  //           network: networkProvider,
  //           serviceID, // ✅ ADDED
  //           planId: selectedPlan,
  //           plan_code: planCode,
  //           amount: Number(amount),
  //         },
  //       }),
  //     });

  //     const raw = await res.text();
  //     let out: any = null;

  //     try {
  //       out = JSON.parse(raw);
  //     } catch {
  //       console.warn("Non-JSON response from /api/payments/initiate:", raw);
  //       throw new Error("Server returned an invalid response.");
  //     }

  //     if (!res.ok) {
  //       console.warn("Initiate error:", out);
  //       throw new Error(out?.error || "Payment init failed");
  //     }

  //     if (out?.type === "form_post" && out?.actionUrl && out?.fields) {
  //       const form = document.createElement("form");
  //       form.method = "POST";
  //       form.action = out.actionUrl;

  //       Object.entries(out.fields).forEach(([k, v]) => {
  //         const input = document.createElement("input");
  //         input.type = "hidden";
  //         input.name = k;
  //         input.value = String(v);
  //         form.appendChild(input);
  //       });

  //       document.body.appendChild(form);
  //       form.submit();
  //       return;
  //     }

  //     if (out?.type === "redirect" && out?.redirectUrl) {
  //       window.location.href = out.redirectUrl;
  //       return;
  //     }

  //     console.warn("Unexpected initiate response:", out);
  //     throw new Error("No redirect/form returned from server.");
  //   } catch (e: any) {
  //     console.warn("Payment failed:", e);
  //     setError(e?.message || "Payment failed");
  //   } finally {
  //     dispatch(setSubmitting(false));
  //   }
  // };

const handleContinuePayment = async () => {
  setError(null);

  if (!networkProvider) return setError("Please select a network.");
  if (!selectedPlan) return setError("Please select a data plan.");
  // if (!planCode) return setError("Selected plan is missing plan code.");
  if (!phoneNumber) return setError("Please enter a phone number.");
  if (!amount) return setError("Amount is missing.");
  if (!selectedGateway) return setError("Please select a payment gateway.");

  const serviceID = selectedPlanObj?.serviceID;
  if (!serviceID) {
    return setError(
      "Missing serviceID for this plan. Reload plans and select again."
    );
  }

  dispatch(setSubmitting(true));

  try {
    // ✅ get logged-in user + email
    const { data: u, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message);

    const email = u?.user?.email;
    if (!email) throw new Error("You must be signed in to continue.");

    // ✅ get access token (THIS is what you missed)
    const { data: s, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw new Error(sessErr.message);

    const accessToken = s?.session?.access_token;
    if (!accessToken)
      throw new Error("Auth session missing. Please login again.");

    // ✅ call initiate with Bearer token (same as airtime)
    // const res = await fetch("/api/payments/initiate", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${accessToken}`, // ✅ GUARANTEED
    //   },
    //   body: JSON.stringify({
    //     billType: "data",
    //     gateway: selectedGateway,
    //     amount: Number(amount),
    //     email,
    //     meta: {
    //       phone: phoneNumber,
    //       network: networkProvider,
    //       serviceID, // ✅ IMPORTANT
    //       planId: selectedPlan,
    //       plan_code: planCode,
    //       amount: Number(amount),
    //     },
    //   }),
    // });
   console.log("selectedPlanObj:", selectedPlanObj);
  const res = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      billType: "data",
      gateway: selectedGateway,

      phone: phoneNumber,
      network: networkProvider,
      serviceID,
      planId: selectedPlan, // ✅ selectedPlan is already the plan id
      plan_code: selectedPlan, // ✅ same value (variation_code)
      amount: Number(amount),

      plan_name: selectedPlanObj?.name || "",
      validity: selectedPlanObj?.validity || "—",

      email,
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

    // ✅ Interswitch
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

    // ✅ Redirect gateways
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
    dispatch(setSubmitting(false));
  }
};


  const disablePay =
    !networkProvider || !selectedPlan || !phoneNumber || !amount || isSubmitting;

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

      {/* Phone Number */}
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

      {/* Data Plan Dropdown */}
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
                ? `${selectedPlanObj.name} - ₦${Number(selectedPlanObj.amount).toLocaleString()}`
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
                      <p className="text-xs text-gray-500 mt-1">{plan.validity}</p>
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

      {/* Error UI (RIGHT PLACE) */}
      {(error || dataPlansError) && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error || dataPlansError}
        </p>
      )}

      {/* Pay Now */}
      <PayNowButton
        onClick={() => {
          setError(null);
          setOpenModal(true);
        }}
        disabled={disablePay}
        loading={isSubmitting}
      />

      {/* Payment Modal */}
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
