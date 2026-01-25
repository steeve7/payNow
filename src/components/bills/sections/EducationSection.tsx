"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setEducationService, setAmount } from "@/redux/slices/billSlice";
import PayNowButton from "../button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

type ServiceItem = {
  id: string; // serviceID
  title: string; // name
  serviceID: string;
};

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

export default function EducationSection() {
  const dispatch = useAppDispatch();
  const { educationService, amount } = useAppSelector((state) => state.bill);

  //  real services from API
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  //  packages (variations) for selected service
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(
    null
  );
  const [showPackages, setShowPackages] = useState(false);

  // inputs
  const [phone, setPhone] = useState("");
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

  const selectedServiceObj = useMemo(
    () => services.find((s) => s.id === educationService) || null,
    [services, educationService]
  );

  //  load services once
  useEffect(() => {
    const run = async () => {
      setLoadingServices(true);
      setError("");

      try {
        const res = await fetch("/api/bills/education/services", {
          cache: "no-store",
        });
        const out = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(out?.error || "Failed to load education services");

        setServices(Array.isArray(out?.services) ? out.services : []);
      } catch (e: any) {
        setServices([]);
        setError(e?.message || "Failed to load education services");
      } finally {
        setLoadingServices(false);
      }
    };

    run();
  }, []);

  //  when service changes -> load packages (variations) + reset package + reset amount
  useEffect(() => {
    setError("");
    setPackages([]);
    setSelectedPackage(null);
    setShowPackages(false);

    // since amount comes from package, reset it when service changes
    dispatch(setAmount(""));

    if (!educationService) return;

    const run = async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch(
          `/api/bills/education/variations?serviceID=${encodeURIComponent(
            educationService
          )}`,
          { cache: "no-store" }
        );

        const out = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(out?.error || "Failed to load packages");

        setPackages(Array.isArray(out?.packages) ? out.packages : []);
      } catch (e: any) {
        setPackages([]);
        setError(e?.message || "Failed to load packages");
      } finally {
        setLoadingPackages(false);
      }
    };

    run();
  }, [educationService, dispatch]);

  //  when package is selected -> set amount from variation_amount
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
      // keep amount empty if vendor doesn't return price
      dispatch(setAmount(""));
      return;
    }

    dispatch(setAmount(String(n)));
  }, [selectedPackage, dispatch]);

  const canPayNow =
    !!selectedServiceObj &&
    !!selectedPackage &&
    normalizePhoneNG(phone).length >= 10 &&
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

      //  payload saved in DB for verify/vend later
      const payload = {
        serviceID: selectedServiceObj!.serviceID, // education serviceID
        serviceLabel: selectedServiceObj!.title,

        variation_code: selectedPackage!.variation_code,
        packageLabel: selectedPackage!.name,

        phone: normalizePhoneNG(phone),
        contact: contact || "",

        amount: Number(billAmount), // from package
        totalAmount: Number(totalAmount),
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          billType: "education",
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
    <div className="space-y-4">
      {/*  Education Service (SAME UI STYLE, now from API) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#374151]">
          Education Service
        </label>

        {loadingServices ? (
          <div className="text-sm text-gray-500">Loading services...</div>
        ) : null}

        <div className="space-y-4">
          {services.map((service) => {
            const active = educationService === service.id;

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => dispatch(setEducationService(service.id))}
                className={[
                  "w-full text-left rounded-xl border px-4 py-4 transition",
                  active
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[#4338ca]">
                    {service.title}
                  </span>
                  <span className="mt-1 text-sm text-[#4338ca]">
                    {service.serviceID}
                  </span>
                </div>
              </button>
            );
          })}

          {!loadingServices && services.length === 0 ? (
            <div className="text-sm text-gray-500">No services returned.</div>
          ) : null}
        </div>
      </div>

      {/*  Select Package (only when service selected) */}
      {educationService ? (
        <div className="relative">
          <label className="block text-sm font-medium mb-1 text-[#374151]">
            Select Package
          </label>

          <button
            type="button"
            onClick={() => setShowPackages((v) => !v)}
            className={inputClass + " flex items-center justify-between"}
            disabled={loadingPackages}
          >
            <span>
              {loadingPackages
                ? "Loading packages..."
                : selectedPackage?.name || "Select package"}
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
                  No packages returned.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Phone Number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 14))}
          placeholder="Enter candidate phone number"
          className={inputClass}
        />
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
          placeholder="your@email.com or 08123456789"
          className={inputClass}
        />
        <p className="mt-2 text-sm text-[#6b720]">
          Receive your transaction confirmation via email or SMS
        </p>
      </div>

      {/* Amount (auto from package) */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">
          Amount (₦)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            ₦
          </span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amount || ""}
            onChange={(e) => dispatch(setAmount(e.target.value))}
            className={`${inputClass} pl-10`}
          />
        </div>

        {/* Info box */}
        {educationService ? (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
            {selectedServiceObj
              ? `Selected: ${selectedServiceObj.title}`
              : "Select a service to continue."}
          </div>
        ) : null}
      </div>

      {/* Breakdown (optional) */}
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
