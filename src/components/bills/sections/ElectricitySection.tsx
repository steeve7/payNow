"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  setElectricityProvider,
  setMeterType,
  setMeterNumber,
  validateMeter,
  setAmount,
} from "@/redux/slices/billSlice";
import PayNowButton from "@/components/bills/button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

type Disco = {
  id: string;         // your internal id for UI (e.g. "ikeja")
  label: string;      // "Ikeja Electric"
  serviceID: string;  // VTPass serviceID (e.g. "ikeja-electric")
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

export default function ElectricitySection() {
  const dispatch = useAppDispatch();

  const {
    electricityProvider,
    meterType,
    meterNumber,
    isMeterValidated,
    amount,
  } = useAppSelector((state) => state.bill);

  const [providers, setProviders] = useState<Disco[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const [validating, setValidating] = useState(false);
  const [meterError, setMeterError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const [contact, setContact] = useState(""); // optional receipt email/phone
  const [phone, setPhone] = useState("");     // required by many electricity vendors

  // payment modal
  const [openModal, setOpenModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [payLoading, setPayLoading] = useState(false);

  const serviceCharge = 100;
  const billAmount = Number(amount || 0);
  const totalAmount = billAmount + serviceCharge;

  const quickAmounts = [1000, 2000, 5000, 10000];

  const selectedProviderObj = useMemo(
    () => providers.find((p) => p.id === electricityProvider) || null,
    [providers, electricityProvider]
  );

  // Load electricity providers from API
  useEffect(() => {
    const run = async () => {
      setLoadingProviders(true);
      try {
        const res = await fetch("/api/bills/electricity/providers", { cache: "no-store" });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out?.error || "Failed to load providers");
        setProviders(out?.providers || []);
      } catch (e: any) {
        setProviders([]);
        setMeterError(e?.message || "Failed to load providers");
      } finally {
        setLoadingProviders(false);
      }
    };

    run();
  }, []);

  // reset verification when inputs change
  useEffect(() => {
    setVerified(false);
    setCustomerName(null);
    setMeterError(null);
    // NOTE: your redux validate flag remains; you can also reset in slice if you want.
    // For now, we just rely on verified + UI.
  }, [electricityProvider, meterType, meterNumber]);

  const canPayNow =
    !!selectedProviderObj &&
    !!meterType &&
    !!meterNumber &&
    verified &&
    billAmount > 0 &&
    !meterError &&
    normalizePhoneNG(phone).length >= 10;

  const handleValidateMeter = async () => {
    setValidating(true);
    setMeterError(null);

    try {
      if (!selectedProviderObj) throw new Error("Please select electricity provider.");
      if (!meterType) throw new Error("Please select meter type.");
      if (!meterNumber || meterNumber.trim().length < 6) {
        throw new Error("Invalid meter number. Please check and try again.");
      }

      const res = await fetch("/api/bills/electricity/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProviderObj.id,
          serviceID: selectedProviderObj.serviceID,
          meterType,
          meterNumber: meterNumber.trim(),
        }),
      });

      const out = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(out?.error || "Meter verification failed");

      const name = String(out?.customerName || "").trim();
      if (!name) throw new Error("Invalid meter number. Please check and try again.");

      setVerified(true);
      setCustomerName(name);

      // keep your redux flag too
      dispatch(validateMeter());
    } catch (e: any) {
      setVerified(false);
      setCustomerName(null);
      setMeterError(e?.message || "Invalid meter number. Please check and try again.");
    } finally {
      setValidating(false);
    }
  };

  const onContinue = async () => {
    setMeterError(null);

    if (!selectedGateway) return setMeterError("Please select a payment gateway.");
    if (!canPayNow) return setMeterError("Please complete the required fields.");

    setPayLoading(true);

    try {
      // logged in user + token (same as your working airtime flow)
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);

      const email = u?.user?.email;
      if (!email) throw new Error("You must be signed in to continue.");

      const { data: s, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      const accessToken = s?.session?.access_token;
      if (!accessToken) throw new Error("Auth session missing. Please login again.");

      const payload = {
        provider: selectedProviderObj!.id,
        providerLabel: selectedProviderObj!.label,
        serviceID: selectedProviderObj!.serviceID,
        meterType, // "prepaid" | "postpaid"
        meterNumber: meterNumber.trim(),
        customerName: customerName || undefined,
        phone: normalizePhoneNG(phone),
        contact: contact || undefined,   // optional
        amount: Number(billAmount),      // vend amount
        totalAmount: Number(totalAmount) // what you charged user (includes service charge)
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          billType: "electricity",
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
      setMeterError(e?.message || "Payment failed");
    } finally {
      setPayLoading(false);
      setOpenModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider */}
      <div>
        <label className="block text-sm font-medium mb-2 text-[#374151]">
          Select Electricity Provider (DISCO)
        </label>

        <select
          value={electricityProvider}
          onChange={(e) => dispatch(setElectricityProvider(e.target.value))}
          className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          disabled={loadingProviders}
        >
          <option value="">
            {loadingProviders ? "Loading providers..." : "Select provider"}
          </option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Meter Type */}
      {selectedProviderObj && (
        <div>
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Meter Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["prepaid", "postpaid"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => dispatch(setMeterType(type))}
                className={`p-4 rounded-xl border text-center font-medium transition
                  ${
                    meterType === type
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-400"
                  }`}
                style={{ color: "#4338ca" }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meter Number */}
      {meterType && (
        <div>
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Meter Number
          </label>
          <input
            value={meterNumber}
            onChange={(e) => dispatch(setMeterNumber(e.target.value))}
            placeholder="Enter your meter number"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          {meterError && <p className="text-xs text-red-500 mt-1">{meterError}</p>}
        </div>
      )}

      {/* Verify Meter */}
      {meterNumber && !verified && (
        <button
          onClick={handleValidateMeter}
          disabled={validating}
          className="w-full mt-2 p-4 text-white rounded-xl disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
          type="button"
        >
          {validating ? "Verifying..." : "Verify Meter"}
        </button>
      )}

      {/* Verified */}
      {verified && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Verified ✅{" "}
          {customerName ? (
            <span className="font-semibold">Customer: {customerName}</span>
          ) : null}
        </div>
      )}

      {/* Phone (required for vendors) */}
      {verified && (
        <div>
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Phone Number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 14))}
            placeholder="08123456789"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Required for token delivery / receipt
          </p>
        </div>
      )}

      {/* Optional contact */}
      {verified && (
        <div>
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Email or Phone Number (Optional)
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="your@email.com or 08123456789"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Receive your electricity token and receipt via email or SMS
          </p>
        </div>
      )}

      {/* Amount */}
      {verified && (
        <div>
          <label className="block text-sm font-medium mb-2 text-[#374151]">
            Bill Amount (₦)
          </label>

          <input
            type="number"
            value={amount}
            onChange={(e) => dispatch(setAmount(e.target.value))}
            placeholder="₦"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />

          <div className="flex flex-wrap gap-5 mt-3">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => dispatch(setAmount(String(amt)))}
                className="px-3 py-2 w-[130px] rounded-lg border font-medium"
                style={{ color: "#4f46e5", borderColor: "#4f46e5" }}
              >
                ₦{amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown */}
      {billAmount > 0 && (
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
      )}

      {/* Pay Now */}
      {verified && (
        <>
          <PayNowButton
            disabled={!canPayNow}
            onClick={() => setOpenModal(true)}
            loading={false}
            label="Pay Now"
          />

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
        </>
      )}
    </div>
  );
}
