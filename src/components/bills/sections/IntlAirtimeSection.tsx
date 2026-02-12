"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  setIntlCountry,
  setIntlService,
  setIntlOperator,
  setSelectedPlan,
  setAmount,
} from "@/redux/slices/billSlice";
import PayNowButton from "@/components/bills/button/PayNowButton";
import PaymentModal from "@/components/features/PaymentModal";
import { supabase } from "@/lib/supabaseClient";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

type Country = {
  code: string;
  name: string;
  prefix?: string;
  currency?: string;
  flag?: string;
};

type ProductType = { id: string; name: string };
type Operator = { id: string; name: string; image?: string };

type IntlPackage = {
  variation_code: string;
  name: string;
  fixedPrice?: string;
  variation_amount?: string | number;
  charged_amount?: string | number | null;
  variation_rate?: string | number | null;
};

function digitsOnly(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function toE164Digits(countryPrefix: string, rawPhone: string) {
  const pfx = digitsOnly(countryPrefix);
  let n = digitsOnly(rawPhone);

  if (!n) return "";

  if (n.startsWith("0")) n = n.replace(/^0+/, "");
  if (pfx && n.startsWith(pfx)) return n;
  if (pfx) return `${pfx}${n}`;
  return n;
}

function isValidE164Digits(d: string) {
  const x = digitsOnly(d);
  return !!x && x.length >= 10 && x.length <= 15 && !x.startsWith("0");
}

export default function IntlAirtimeSection() {
  const dispatch = useAppDispatch();
  const {
    selectedCountry,
    selectedProductType,
    selectedOperator,
    selectedPlan,
    amount,
    selectedIntlServiceID,
  } = useAppSelector((s) => s.bill);

  const [recipientPhone, setRecipientPhone] = useState("");
  const [contact, setContact] = useState("");

  const [countries, setCountries] = useState<Country[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [packages, setPackages] = useState<IntlPackage[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [error, setError] = useState("");

  const [openModal, setOpenModal] = useState(false);

  // only paystack + seerbit
  const [selectedGateway, setSelectedGateway] = useState("paystack");
  const [payLoading, setPayLoading] = useState(false);

  const billAmount = Number(amount || 0);
  const totalAmount = billAmount;

  const selectedCountryObj = useMemo(
    () => countries.find((c) => c.code === selectedCountry) || null,
    [countries, selectedCountry]
  );

  const selectedOperatorObj = useMemo(
    () => operators.find((o) => o.id === selectedOperator) || null,
    [operators, selectedOperator]
  );

  const selectedPkg = useMemo(
    () => packages.find((p) => p.variation_code === selectedPlan) || null,
    [packages, selectedPlan]
  );

  const e164Digits = useMemo(() => {
    const prefix = selectedCountryObj?.prefix || "";
    return toE164Digits(prefix, recipientPhone);
  }, [selectedCountryObj, recipientPhone]);

  const e164Ok = useMemo(() => isValidE164Digits(e164Digits), [e164Digits]);

  // 1) load countries
  useEffect(() => {
    const run = async () => {
      setLoadingCountries(true);
      setError("");
      try {
        const res = await fetch("/api/bills/international/countries", {
          cache: "no-store",
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out?.error || "Failed to load countries");
        setCountries(Array.isArray(out?.countries) ? out.countries : []);
      } catch (e: any) {
        setCountries([]);
        setError(e?.message || "Failed to load countries");
      } finally {
        setLoadingCountries(false);
      }
    };
    run();
  }, []);

  // reset chain when country changes
  useEffect(() => {
    setError("");
    setProductTypes([]);
    setOperators([]);
    setPackages([]);
    dispatch(setSelectedPlan(""));
    dispatch(setAmount(""));

    if (!selectedCountry) return;

    const run = async () => {
      setLoadingTypes(true);
      try {
        const res = await fetch(
          `/api/bills/international/product-types?code=${encodeURIComponent(
            selectedCountry
          )}`,
          { cache: "no-store" }
        );
        const out = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(out?.error || "Failed to load service types");
        setProductTypes(Array.isArray(out?.productTypes) ? out.productTypes : []);
      } catch (e: any) {
        setProductTypes([]);
        setError(e?.message || "Failed to load service types");
      } finally {
        setLoadingTypes(false);
      }
    };

    run();
  }, [selectedCountry, dispatch]);

  // service type -> operators
  useEffect(() => {
    setError("");
    setOperators([]);
    setPackages([]);

    dispatch(setIntlOperator(""));
    dispatch(setSelectedPlan(""));
    dispatch(setAmount(""));

    if (!selectedCountry || !selectedProductType) return;

    const run = async () => {
      setLoadingOperators(true);
      try {
        const res = await fetch(
          `/api/bills/international/operators?code=${encodeURIComponent(
            selectedCountry
          )}&product_type_id=${encodeURIComponent(selectedProductType)}`,
          { cache: "no-store" }
        );
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out?.error || "Failed to load operators");
        setOperators(Array.isArray(out?.operators) ? out.operators : []);
      } catch (e: any) {
        setOperators([]);
        setError(e?.message || "Failed to load operators");
      } finally {
        setLoadingOperators(false);
      }
    };

    run();
  }, [selectedCountry, selectedProductType, dispatch]);

  // operator -> packages
  useEffect(() => {
    setError("");
    setPackages([]);
    dispatch(setSelectedPlan(""));
    dispatch(setAmount(""));

    const svc = String(selectedIntlServiceID || "").trim();
    const opId = String(selectedOperator || "").trim();
    const ptId = String(selectedProductType || "").trim();

    if (!svc || !opId || !ptId) return;

    const run = async () => {
      setLoadingPackages(true);
      try {
        const url = `/api/bills/international/packages?serviceID=${encodeURIComponent(
          svc
        )}&operator_id=${encodeURIComponent(opId)}&product_type_id=${encodeURIComponent(ptId)}`;

        const res = await fetch(url, { cache: "no-store" });
        const out = await res.json().catch(() => ({}));
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
  }, [selectedIntlServiceID, selectedOperator, selectedProductType, dispatch]);

  // package -> amount
  useEffect(() => {
    if (!selectedPkg) return;

    const raw = selectedPkg.charged_amount ?? selectedPkg.variation_amount ?? 0;
    const val =
      typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0;

    if (!Number.isFinite(val) || val <= 0) {
      dispatch(setAmount(""));
      return;
    }
    dispatch(setAmount(String(val)));
  }, [selectedPkg, dispatch]);

  const canPayNow =
    !!selectedCountry &&
    !!selectedProductType &&
    !!selectedIntlServiceID &&
    !!selectedOperator &&
    !!selectedPlan &&
    e164Ok &&
    billAmount > 0;

  const onContinue = async () => {
    setError("");

    if (!selectedGateway) return setError("Please select a payment gateway.");
    if (!["paystack", "seerbit"].includes(selectedGateway)) {
      return setError("Selected gateway is not supported.");
    }

    if (!canPayNow) return setError("Please complete the required fields.");
    if (!selectedCountryObj?.name || !selectedCountryObj?.code) {
      return setError("Country details missing. Reload and re-select country.");
    }
    if (!selectedOperatorObj?.name) {
      return setError("Operator name missing. Reload and re-select operator.");
    }

    setPayLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const payload = {
        serviceID: String(selectedIntlServiceID || "").trim(),
        country_code: String(selectedCountryObj.code || "").trim().toUpperCase(),
        country: String(selectedCountryObj.name || "").trim(),
        operator_id: String(selectedOperator || "").trim(),
        operator: String(selectedOperatorObj.name || "").trim(),
        product_type_id: String(selectedProductType || "").trim(),
        variation_code: String(selectedPlan || "").trim(),
        billersCode: e164Digits,
        phone: e164Digits,
        contact: String(contact || "").trim(),
        amount: Number(billAmount),
      };

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          billType: "intl_airtime",
          gateway: selectedGateway,
          amount: Number(totalAmount),
          customer_phone: e164Digits,
          payload,
          meta: { ...payload, guest: !session?.user },
        }),
      });

      const out = await res.json().catch(() => ({}));

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
      {/* Country */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">Select Country</label>
        <select
          value={selectedCountry}
          onChange={(e) => dispatch(setIntlCountry(e.target.value))}
          className={inputClass}
          disabled={loadingCountries}
        >
          <option value="">
            {loadingCountries ? "Loading countries..." : "Select country"}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {/* Service Type */}
      {selectedCountry ? (
        <div>
          <label className="block text-sm font-medium mb-1 text-[#374151]">Select Service Type</label>
          <select
            value={selectedProductType}
            onChange={(e) => {
              const id = e.target.value;
              const obj = productTypes.find((p) => p.id === id);
              dispatch(setIntlService({ id, name: obj?.name || "" }));
            }}
            className={inputClass}
            disabled={loadingTypes}
          >
            <option value="">
              {loadingTypes ? "Loading service types..." : "Select service type"}
            </option>
            {productTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {selectedIntlServiceID ? (
            <p className="mt-2 text-xs text-gray-500">
              VTPass serviceID:{" "}
              <span className="font-mono text-gray-700">{selectedIntlServiceID}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Operator */}
      {selectedProductType ? (
        <div>
          <label className="block text-sm font-medium mb-1 text-[#374151]">Select Operator</label>
          <select
            value={selectedOperator}
            onChange={(e) => dispatch(setIntlOperator(e.target.value))}
            className={inputClass}
            disabled={loadingOperators}
          >
            <option value="">
              {loadingOperators ? "Loading operators..." : "Select operator"}
            </option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Package */}
      {selectedOperator ? (
        <div>
          <label className="block text-sm font-medium mb-1 text-[#374151]">Select Package</label>
          <select
            value={selectedPlan}
            onChange={(e) => dispatch(setSelectedPlan(e.target.value))}
            className={inputClass}
            disabled={loadingPackages}
          >
            <option value="">
              {loadingPackages ? "Loading packages..." : "Select package"}
            </option>
            {packages.map((p) => (
              <option key={p.variation_code} value={p.variation_code}>
                {p.name}
              </option>
            ))}
          </select>

          {selectedOperator && !loadingPackages && packages.length === 0 ? (
            <p className="mt-2 text-xs text-amber-600">
              No packages returned for this operator/service. Try another operator or service type.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Recipient phone */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">Recipient Phone Number</label>
        <input
          type="tel"
          value={recipientPhone}
          onChange={(e) => setRecipientPhone(e.target.value)}
          placeholder="e.g. 0913... or 234..."
          className={inputClass}
        />
        <p className="mt-2 text-xs text-gray-500">
          Converted to E.164 digits:{" "}
          <span className="font-mono text-gray-700">{e164Digits ? `+${e164Digits}` : "-"}</span>
        </p>
        {!e164Ok && recipientPhone.trim() ? (
          <p className="mt-2 text-xs text-red-600">
            Enter a valid international number. Example: 2349138307392 (no +).
          </p>
        ) : null}
      </div>

      {/* Optional contact */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">Email or Phone (Optional)</label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="your@email.com or 08123456789"
          className={inputClass}
        />
        <p className="mt-2 text-sm text-gray-500">Receive confirmation via email or SMS</p>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-1 text-[#374151]">Amount (₦)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
          <input
            type="text"
            value={amount ? Number(amount).toLocaleString() : ""}
            readOnly
            className={`${inputClass} pl-10 bg-gray-100`}
            placeholder="0.00"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="pt-2">
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
