"use client";

import { useEffect, useMemo, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import PayNowButton from "../button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient"; // adjust to your actual path

const PROVIDERS = [
  { id: "dstv", label: "DSTV" },
  { id: "gotv", label: "GOTV" },
  { id: "startimes", label: "Startimes" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function normalizePhoneNG(v: string) {
  // keep your own normalize if you already have one
  const d = onlyDigits(v);
  if (d.startsWith("0") && d.length === 11) return d;
  if (d.startsWith("234") && d.length === 13) return `0${d.slice(3)}`;
  return d;
}

type Variation = {
  variation_code: string;
  name: string;
  variation_amount?: string | number;
  fixedPrice?: string;
};

export default function CableSection() {
  const [provider, setProvider] = useState<ProviderId | "">("");
  const [smartcard, setSmartcard] = useState("");
  const [smartcardError, setSmartcardError] = useState("");

  const [phone, setPhone] = useState("");

  const [verified, setVerified] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  const [bouquets, setBouquets] = useState<Variation[]>([]);
  const [loadingBouquets, setLoadingBouquets] = useState(false);

  const [selectedBouquet, setSelectedBouquet] = useState<Variation | null>(
    null
  );
  const [showBouquets, setShowBouquets] = useState(false);

  const [months, setMonths] = useState(1);
  const [contact, setContact] = useState(""); // optional email/phone for receipt

  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>("");

  // payment modal
  const [openModal, setOpenModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [payLoading, setPayLoading] = useState(false);

  // when provider changes, reset & load bouquets
  useEffect(() => {
    setVerified(false);
    setCustomerName(null);
    setSmartcard("");
    setSelectedBouquet(null);
    setBouquets([]);
    setError("");

    if (!provider) return;

    const run = async () => {
      setLoadingBouquets(true);
      try {
        const res = await fetch(`/api/bills/cable/variations?provider=${provider}`, {
          cache: "no-store",
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out?.error || "Failed to load bouquets");
        setBouquets(out?.variations || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load bouquets");
      } finally {
        setLoadingBouquets(false);
      }
    };

    run();
  }, [provider]);

  const bouquetPrice = useMemo(() => {
    const a = selectedBouquet?.variation_amount;
    const n = typeof a === "string" ? Number(a) : typeof a === "number" ? a : 0;
    return Number.isFinite(n) ? n : 0;
  }, [selectedBouquet]);

  const billAmount = bouquetPrice * months;
  const serviceCharge = 100;
  const totalAmount = billAmount + serviceCharge;

  const canPayNow =
    provider &&
    verified &&
    selectedBouquet &&
    months > 0 &&
    billAmount > 0 &&
    normalizePhoneNG(phone).length >= 10;

  // const verifySmartcard = async () => {
  //   setError("");
  //   setValidating(true);

  //   try {
  //     if (!provider) throw new Error("Please select a provider.");
  //     if (smartcard.trim().length < 6)
  //       throw new Error("Invalid Smartcard / IUC number");

  //     const res = await fetch("/api/cable/verify", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         provider,
  //         billersCode: smartcard.trim(),
  //       }),
  //     });

  //     const out = await res.json().catch(() => ({}));
  //     if (!res.ok) throw new Error(out?.error || "Verification failed");

  //     setVerified(true);
  //     setCustomerName(out?.customerName || null);
  //   } catch (e: any) {
  //     setVerified(false);
  //     setCustomerName(null);
  //     setError(e?.message || "Verification failed");
  //   } finally {
  //     setValidating(false);
  //   }
  // };

  const handleValidate = async () => {
  setValidating(true);
  setSmartcardError("");
  setError("");

  try {
    if (!provider) throw new Error("Please select a provider.");
    if (smartcard.trim().length < 6)
      throw new Error("Invalid Smartcard / IUC number");

    const res = await fetch("/api/bills/cable/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        smartcardNumber: smartcard.trim(),
      }),
    });

    const out = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      throw new Error(out?.error || "Smartcard verification failed");
    }

    //  STRICT CHECK — this is the key fix
    const name =
      out?.customerName ||
      out?.customer_name ||
      out?.name ||
      out?.data?.customer_name;

    if (!name) {
      throw new Error("Invalid Smartcard / IUC number");
    }

    // only here do we mark verified
    setVerified(true);
    setCustomerName(name);
  } catch (e: any) {
    setVerified(false);
    setCustomerName(null);
    setSmartcardError(e?.message || "Invalid Smartcard / IUC number");
  } finally {
    setValidating(false);
  }
};


  const onContinue = async () => {
    setError("");
    if (!selectedGateway) return setError("Please select a payment gateway.");
    if (!canPayNow) return setError("Please complete the required fields.");

    setPayLoading(true);

    try {
      //  get logged-in user + token (same as your working airtime flow)
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
        provider,
        smartcardNumber: smartcard.trim(),
        bouquet: selectedBouquet!.variation_code, // VTPass expects variation_code
        bouquetLabel: selectedBouquet!.name,
        months,
        phone: normalizePhoneNG(phone), // REQUIRED by VTPass pay
        contact, // optional
        amount: Number(billAmount), // subscription amount (without service charge)
        totalAmount: Number(totalAmount), // what you charged the user
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`, //  same trick as airtime
        },
        body: JSON.stringify({
          billType: "cable",
          gateway: selectedGateway,
          amount: Number(totalAmount), //  charge total amount
          email,
          meta: payload, // keep for gateway metadata
          payload, //  save for verify/vend
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
      {/* Select Provider */}
      <div>
        <label className="text-sm font-medium mb-2 block text-[#374151]">
          Select Provider
        </label>
        <div className="grid grid-cols-3 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`p-3 rounded-xl border text-sm transition-all
                ${
                  provider === p.id
                    ? "border-blue-500 bg-blue-50 shadow-md text-blue-500"
                    : "border-gray-200 hover:border-blue-300"
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Smartcard / IUC */}
      {provider && (
        <div>
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Smartcard / IUC Number
          </label>
          <input
            value={smartcard}
            onChange={(e) => {
              setSmartcard(e.target.value);
              setVerified(false);
              setCustomerName(null);
            }}
            placeholder="Enter your Smartcard or IUC number"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          {smartcardError ? (
  <p className="text-xs text-red-600 mt-1">{smartcardError}</p>
) : null}
        </div>
        
      )}

      {/* Verify */}
      {provider && smartcard.trim().length > 0 && !verified && (
        <button
          onClick={handleValidate}
          type="button"
          disabled={validating}
          className="w-full mt-2 p-4 text-white rounded-xl disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          {validating ? "Verifying..." : "Verify Smartcard"}
        </button>
      )}

      {/* Verified Customer */}
      {verified && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Verified ✅{" "}
          {customerName ? (
            <span className="font-semibold">Customer: {customerName}</span>
          ) : null}
        </div>
      )}

      {/* Select Bouquet */}
      {verified && (
        <div className="relative">
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Select Bouquet
          </label>

          <button
            onClick={() => setShowBouquets((v) => !v)}
            className="w-full p-3 border rounded-xl flex justify-between items-center focus:ring-2 focus:ring-blue-300"
          >
            {loadingBouquets
              ? "Loading bouquets..."
              : selectedBouquet?.name || "Choose a Bouquet"}
            <FaChevronDown />
          </button>

          {showBouquets && !loadingBouquets && (
            <div className="mt-2 bg-white border rounded-xl shadow transition-all duration-200 max-h-72 overflow-auto">
              {bouquets.map((b) => (
                <button
                  key={b.variation_code}
                  onClick={() => {
                    setSelectedBouquet(b);
                    setShowBouquets(false);
                  }}
                  className="w-full p-3 text-left hover:bg-blue-50"
                >
                  {b.name}{" "}
                  {b.variation_amount ? (
                    <>– ₦{Number(b.variation_amount).toLocaleString()}</>
                  ) : null}
                </button>
              ))}
              {bouquets.length === 0 && (
                <div className="p-3 text-sm text-gray-500">
                  No bouquets returned.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Months */}
      {selectedBouquet && (
        <div>
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Number of Months
          </label>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} Month{m > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Choose how many months you want to subscribe
          </p>
        </div>
      )}

      {/* Required phone for VTPass pay */}
      {selectedBouquet && (
        <div>
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Phone Number
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 14))}
            placeholder="08123456789"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Required for subscription processing
          </p>
        </div>
      )}

      {/* Email or Phone (Optional receipt) */}
      {selectedBouquet && (
        <div>
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Email or Phone Number (Optional)
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="your@email.com or 08123456789"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Receive your transaction confirmation via email or SMS
          </p>
        </div>
      )}

      {/* Breakdown */}
      {selectedBouquet && (
        <>
          <div>
            <label className="text-sm font-medium mb-2 block text-[#374151]">
              Bill Amount (₦)
            </label>
            <input
              readOnly
              value={`₦${billAmount.toLocaleString()}`}
              className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
            />
          </div>

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
              <span className="font-normal text-[#1e3a8a]">
                ₦{serviceCharge}
              </span>
            </div>

            <hr className="border-blue-200" />

            <div className="flex justify-between font-semibold">
              <span className="font-normal text-[#1e3a8a]">Total Amount</span>
              <span className="font-normal text-[#1e3a8a]">
                ₦{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

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
