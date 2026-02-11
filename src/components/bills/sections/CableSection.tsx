"use client";

import { useEffect, useMemo, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import PayNowButton from "../button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

const PROVIDERS = [
  { id: "dstv", label: "DSTV" },
  { id: "gotv", label: "GOTV" },
  { id: "startimes", label: "Startimes" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}
function normalizePhoneNG(v: string) {
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

  const [selectedBouquet, setSelectedBouquet] = useState<Variation | null>(null);
  const [showBouquets, setShowBouquets] = useState(false);

  const [months, setMonths] = useState(1);
  const [contact, setContact] = useState("");

  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string>("");

  const [openModal, setOpenModal] = useState(false);

  // default to paystack (PaymentModal will also guard)
  const [selectedGateway, setSelectedGateway] = useState<string>("paystack");

  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    setVerified(false);
    setCustomerName(null);
    setSmartcard("");
    setSelectedBouquet(null);
    setBouquets([]);
    setError("");
    setSmartcardError("");

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

  const billAmount = bouquetPrice * months; // vend amount
  const serviceCharge = 100;
  const totalAmount = billAmount + serviceCharge; // charged amount

  const canPayNow =
    provider &&
    verified &&
    selectedBouquet &&
    months > 0 &&
    billAmount > 0 &&
    normalizePhoneNG(phone).length >= 10;

  const handleValidate = async () => {
    setValidating(true);
    setSmartcardError("");
    setError("");

    try {
      if (!provider) throw new Error("Please select a provider.");
      if (smartcard.trim().length < 6) throw new Error("Invalid Smartcard / IUC number");

      const res = await fetch("/api/bills/cable/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          smartcardNumber: smartcard.trim(),
        }),
      });

      const out = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(out?.error || "Smartcard verification failed");

      const name =
        out?.customerName ||
        out?.customer_name ||
        out?.name ||
        out?.data?.customer_name;

      if (!name) throw new Error("Invalid Smartcard / IUC number");

      setVerified(true);
      setCustomerName(String(name));
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
    // only allow paystack | seerbit
    if (!["paystack", "seerbit"].includes(selectedGateway)) {
      return setError("Selected gateway is not supported.");
    }

    if (!canPayNow) return setError("Please complete the required fields.");

    setPayLoading(true);

    try {
      // optional session (guest allowed)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      const customerPhone = normalizePhoneNG(phone);
      if (!customerPhone || customerPhone.length < 10) {
        throw new Error("Please enter a valid phone number.");
      }

      const payload = {
        provider,
        smartcardNumber: smartcard.trim(),
        bouquet: selectedBouquet!.variation_code,
        bouquetLabel: selectedBouquet!.name,
        months,
        phone: customerPhone, // phone-based identity + vend phone
        contact,
        amount: Number(billAmount), // vend amount (must be <= paid)
        totalAmount: Number(totalAmount), // charged amount (UI)
        customerName: customerName || "",
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          billType: "cable",
          gateway: selectedGateway,

          // PAID AMOUNT (what gateway charges)
          amount: Number(totalAmount),

          // phone-based unique id
          customer_phone: customerPhone,

          // keep both meta + payload (your initiate merges)
          meta: { ...payload, guest: !session?.user },
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

      if (out?.type === "redirect" && out?.redirectUrl) {
        window.location.href = out.redirectUrl;
        return;
      }

      throw new Error("No redirect returned from server.");
    } catch (e: any) {
      setError(e?.message || "Payment failed");
    } finally {
      setPayLoading(false);
      setOpenModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* provider */}
      <div>
        <label className="text-sm font-medium mb-2 block text-[#374151]">
          Select Provider
        </label>
        <div className="grid grid-cols-3 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`p-3 rounded-xl border text-sm transition-all ${
                provider === p.id
                  ? "border-blue-500 bg-blue-50 shadow-md text-blue-500"
                  : "border-gray-200 hover:border-blue-300"
              }`}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* smartcard */}
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

      {/* verify */}
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

      {verified && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Verified ✅{" "}
          {customerName ? (
            <span className="font-semibold">Customer: {customerName}</span>
          ) : null}
        </div>
      )}

      {/* bouquet */}
      {verified && (
        <div className="relative">
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Select Bouquet
          </label>

          <button
            onClick={() => setShowBouquets((v) => !v)}
            className="w-full p-3 border rounded-xl flex justify-between items-center focus:ring-2 focus:ring-blue-300"
            type="button"
          >
            {loadingBouquets
              ? "Loading bouquets..."
              : selectedBouquet?.name || "Choose a Bouquet"}
            <FaChevronDown />
          </button>

          {showBouquets && !loadingBouquets && (
            <div className="mt-2 bg-white border rounded-xl shadow max-h-72 overflow-auto">
              {bouquets.map((b) => (
                <button
                  key={b.variation_code}
                  onClick={() => {
                    setSelectedBouquet(b);
                    setShowBouquets(false);
                  }}
                  className="w-full p-3 text-left hover:bg-blue-50"
                  type="button"
                >
                  {b.name}{" "}
                  {b.variation_amount ? (
                    <>– ₦{Number(b.variation_amount).toLocaleString()}</>
                  ) : null}
                </button>
              ))}
              {bouquets.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">No bouquets returned.</div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* months */}
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
        </div>
      )}

      {/* required phone */}
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
        </div>
      )}

      {/* optional contact */}
      {selectedBouquet && (
        <div>
          <label className="text-sm font-medium mb-2 block text-[#374151]">
            Contact (optional)
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Name / email (optional)"
            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

      {/* breakdown + pay */}
      {selectedBouquet && (
        <>
          <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#1d4ed8]">Bill Amount</span>
              <span className="text-[#1e3a8a]">₦{billAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#1d4ed8]">Service Charge</span>
              <span className="text-[#1e3a8a]">₦100</span>
            </div>
            <hr className="border-blue-200" />
            <div className="flex justify-between font-semibold">
              <span className="text-[#1e3a8a]">Total Amount</span>
              <span className="text-[#1e3a8a]">₦{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <PayNowButton
            disabled={!canPayNow}
            onClick={() => {
              setError("");
              setOpenModal(true);
            }}
            loading={payLoading}
            label="Pay Now"
            allowGuest={true}
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
