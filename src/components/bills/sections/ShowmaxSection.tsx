"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setSelectedPlan, setAmount } from "@/redux/slices/billSlice";
import PayNowButton from "@/components/bills/button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

type PackageItem = {
  variation_code: string;
  name: string;
  variation_amount?: string | number;
  fixedPrice?: string;
};

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}
function normalizePhoneNG(v: string) {
  const d = onlyDigits(v);
  if (d.startsWith("0") && d.length === 11) return d;
  if (d.startsWith("234") && d.length === 13) return `0${d.slice(3)}`;
  return d;
}

export default function ShowmaxSection() {
  const dispatch = useAppDispatch();
  const { selectedPlan, amount } = useAppSelector((state) => state.bill);

  // packages from API
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(
    null
  );

  // inputs
  const [billersCode, setBillersCode] = useState(""); // Showmax phone number (billersCode)
  const [contact, setContact] = useState("");

  // errors
  const [error, setError] = useState("");

  // payment modal
  const [openModal, setOpenModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [payLoading, setPayLoading] = useState(false);

  const serviceCharge = 100;
  const billAmount = Number(amount || 0);
  const totalAmount = billAmount + serviceCharge;

  // load packages once
  useEffect(() => {
    const run = async () => {
      setLoadingPackages(true);
      setError("");

      try {
        const res = await fetch("/api/bills/showmax/variations", {
          cache: "no-store",
        });
        const out = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(out?.error || "Failed to load Showmax plans");

        const pkgs = Array.isArray(out?.packages) ? out.packages : [];
        setPackages(pkgs);

        // keep selectedPlan in sync if it still exists
        if (selectedPlan) {
          const still = pkgs.find(
            (p: any) => p.variation_code === selectedPlan
          );
          if (still) setSelectedPackage(still);
        }
      } catch (e: any) {
        setPackages([]);
        setError(e?.message || "Failed to load Showmax plans");
      } finally {
        setLoadingPackages(false);
      }
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // whenever selectedPlan changes from redux, reflect locally
  useEffect(() => {
    if (!selectedPlan) {
      setSelectedPackage(null);
      dispatch(setAmount(""));
      return;
    }
    const p = packages.find((x) => x.variation_code === selectedPlan) || null;
    setSelectedPackage(p);
  }, [selectedPlan, packages, dispatch]);

  // when selectedPackage changes -> set amount
  useEffect(() => {
    if (!selectedPackage) return;

    const rawAmt = selectedPackage.variation_amount;
    const n =
      typeof rawAmt === "string"
        ? Number(rawAmt)
        : typeof rawAmt === "number"
        ? rawAmt
        : 0;

    if (!Number.isFinite(n) || n <= 0) {
      dispatch(setAmount(""));
      return;
    }

    dispatch(setAmount(String(n)));
  }, [selectedPackage, dispatch]);

  const canPayNow =
    !!selectedPackage &&
    normalizePhoneNG(billersCode).length >= 10 &&
    billAmount > 0;

  const onContinue = async () => {
    setError("");

    if (!selectedGateway) return setError("Please select a payment gateway.");
    if (!canPayNow) return setError("Please complete the required fields.");

    setPayLoading(true);

    try {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);

      const email = u?.user?.email;
      if (!email) throw new Error("You must be signed in to continue.");

      const { data: s, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      const accessToken = s?.session?.access_token;
      if (!accessToken)
        throw new Error("Auth session missing. Please login again.");

      const payload = {
        serviceID: "showmax",
        variation_code: selectedPackage!.variation_code,
        packageLabel: selectedPackage!.name,
        billersCode: normalizePhoneNG(billersCode), // VTPass needs billersCode for showmax
        contact: contact || "",
        amount: Number(billAmount),
        totalAmount: Number(totalAmount),
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          billType: "showmax",
          gateway: selectedGateway,
          amount: Number(totalAmount),
          email,
          meta: payload,
          payload,
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
      setPayLoading(false);
      setOpenModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan */}
      <div className="relative">
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Select Showmax Plan
        </label>

        <button
          type="button"
          onClick={() => setShowPackages((v) => !v)}
          className={inputClass + " flex items-center justify-between"}
          disabled={loadingPackages}
        >
          <span>
            {loadingPackages
              ? "Loading plans..."
              : selectedPackage?.name || "Select plan"}
          </span>
          <span className="text-gray-500">▾</span>
        </button>

        {showPackages && !loadingPackages ? (
          <div className="mt-2 bg-white border rounded-xl shadow max-h-72 overflow-auto">
            {packages.map((p) => {
              const amt =
                typeof p.variation_amount === "string"
                  ? Number(p.variation_amount)
                  : typeof p.variation_amount === "number"
                  ? p.variation_amount
                  : 0;

              return (
                <button
                  key={p.variation_code}
                  type="button"
                  onClick={() => {
                    setSelectedPackage(p);
                    dispatch(setSelectedPlan(p.variation_code));
                    setShowPackages(false);
                  }}
                  className="w-full p-3 text-left hover:bg-indigo-50"
                >
                  <div className="flex justify-between gap-3">
                    <span>{p.name}</span>
                    {amt > 0 ? (
                      <span className="font-medium">
                        ₦{amt.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.variation_code}
                  </div>
                </button>
              );
            })}

            {packages.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                No plans returned.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Showmax Phone (billersCode) */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Showmax Phone Number
        </label>
        <input
          type="tel"
          value={billersCode}
          onChange={(e) =>
            setBillersCode(onlyDigits(e.target.value).slice(0, 14))
          }
          placeholder="Enter Showmax phone number"
          className={inputClass}
        />
        <p className="mt-2 text-sm text-gray-500">
          This is the phone number on the Showmax account.
        </p>
      </div>

      {/* Optional contact */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Email or Phone Number (Optional)
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="your@email.com or 0812345679"
          className={inputClass}
        />
        <p className="mt-2 text-sm text-[#6b720]">
          Receive your transaction confirmation via email or SMS
        </p>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Amount (₦)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            ₦
          </span>
          <input
            type="text"
            placeholder="0.00"
            value={amount ? Number(amount).toLocaleString() : ""}
            readOnly
            className={`${inputClass} pl-10 bg-gray-100`}
          />
        </div>
      </div>

      {/* Breakdown */}
      {billAmount > 0 ? (
        <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-2">
          <p className="font-normal text-[#1e3a8a]">Payment Breakdown</p>

          <div className="flex justify-between text-sm">
            <span className="font-normal text-[#1d4ed8]">Bill Amount</span>
            <span className="font-normal text-[#1e3a8a]">
              ₦{billAmount.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="font-normal text-[#1d4ed8]">Service Charge</span>
            <span className="font-normal text-[#1e3a8a]">₦{serviceCharge}</span>
          </div>

          <hr className="border-blue-200" />

          <div className="flex justify-between font-semibold">
            <span className="font-normal text-[#1e3a8a]">Total Amount</span>
            <span className="font-normal text-[#1e3a8a]">
              ₦{totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* PayNow + Modal */}
      <div className="pt-2">
        <PayNowButton
          disabled={!canPayNow}
          onClick={() => setOpenModal(true)}
          loading={false}
          label="Pay Now"
        />
      </div>

      <PaymentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        amount={totalAmount}
        title="Choose Payment Method"
        loading={payLoading}
        selectedGateway={selectedGateway}
        setSelectedGateway={setSelectedGateway}
        onContinue={onContinue}
      />
    </div>
  );
}
