"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Status = "loading" | "ok" | "failed";

type VerifyResponse = {
  ok?: boolean;
  status?: "success" | "failed";
  vend?: "success" | "failed" | "already_done";
  vend_error?: string;
  error?: string;
};

type PaymentRow = {
  reference: string;
  bill_type: string;
  status: string;
  vend_status: string | null;
  vend_provider: string | null;
  vend_reference: string | null;
  vend_response: any;
  amount: number;
  currency: string;
  created_at: string;
};

function extractEducationPins(row: PaymentRow | null): {
  pins: string[];
  purchasedCode: string;
} {
  if (!row) return { pins: [], purchasedCode: "" };

  const vr = row.vend_response || {};
  const raw = vr?.raw || {};

  const pinDetails =
    vr?.pinDetails || raw?.pinDetails || raw?.content?.pinDetails || null;

  const purchasedCode = String(
    pinDetails?.purchased_code ||
      raw?.content?.purchased_code ||
      raw?.purchased_code ||
      ""
  ).trim();

  let pins: any[] =
    pinDetails?.pins ||
    raw?.content?.tokens ||
    raw?.tokens ||
    raw?.content?.cards?.map((c: any) => c?.Pin || c?.pin || c?.PIN) ||
    raw?.cards?.map((c: any) => c?.Pin || c?.pin || c?.PIN) ||
    [];

  if (!Array.isArray(pins)) pins = [];

  const cleanedPins = pins.map((x) => String(x || "").trim()).filter(Boolean);

  if (cleanedPins.length === 0 && purchasedCode) {
    cleanedPins.push(purchasedCode);
  }

  const uniq = Array.from(new Set(cleanedPins));
  return { pins: uniq, purchasedCode };
}

export default function CallbackClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const ranRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState<string>("Verifying payment...");
  const [detail, setDetail] = useState<string>("");

  const [gateway, setGateway] = useState<string>("");
  const [reference, setReference] = useState<string>("");

  const [payment, setPayment] = useState<PaymentRow | null>(null);

  // electricity fields
  const [token, setToken] = useState<string>("");
  const [units, setUnits] = useState<string>("");

  // education fields
  const [pins, setPins] = useState<string[]>([]);
  const [purchasedCode, setPurchasedCode] = useState<string>("");

  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      const g = sp.get("gateway") || "";
      const ref = sp.get("reference") || sp.get("trxref") || "";

      setGateway(g);
      setReference(ref);

      if (!g || !ref) {
        setStatus("failed");
        setMsg("Missing gateway/reference in callback URL.");
        return;
      }

      try {
        setStatus("loading");
        setMsg("Verifying payment...");
        setDetail("");

        setPayment(null);

        // reset details
        setToken("");
        setUnits("");
        setPins([]);
        setPurchasedCode("");

        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gateway: g, reference: ref }),
        });

        const out = (await res.json().catch(() => ({}))) as VerifyResponse;

        if (!res.ok) {
          setStatus("failed");
          setMsg(out?.error || "Verify failed");
          return;
        }

        setStatus("ok");

        if (out?.vend === "success") {
          setMsg("Payment verified ✅");
          setDetail("Vending completed successfully");
        } else if (out?.vend === "already_done") {
          setMsg("Payment verified ✅");
          setDetail("Vending already completed earlier");
        } else if (out?.vend === "failed") {
          setMsg("Payment verified ✅");
          setDetail(
            `But vending failed: ${out?.vend_error || "unknown error"}`
          );
        } else {
          setMsg("Payment verified ✅");
          setDetail("");
        }

        // Fetch payment row so we can show token/units/pins
        setLoadingPayment(true);
        try {
          const pRes = await fetch(
            `/api/payments/by-reference?reference=${encodeURIComponent(ref)}`,
            { cache: "no-store" }
          );
          const pOut = await pRes.json().catch(() => ({}));

          if (pRes.ok && pOut?.payment) {
            const row: PaymentRow = pOut.payment;
            setPayment(row);

            // ELECTRICITY: token lives in vend_response.raw.tokenDetails.token
            const tokenVal =
              row?.vend_response?.raw?.tokenDetails?.token ||
              row?.vend_response?.raw?.token ||
              "";

            const unitsVal =
              row?.vend_response?.raw?.tokenDetails?.units ??
              row?.vend_response?.raw?.units ??
              "";

            if (tokenVal) setToken(String(tokenVal));
            if (
              unitsVal !== "" &&
              unitsVal !== null &&
              unitsVal !== undefined
            ) {
              setUnits(String(unitsVal));
            }

            // EDUCATION: pins live in vend_response.pinDetails.pins (or raw.content.tokens etc.)
            const edu = extractEducationPins(row);
            if (edu.pins.length) setPins(edu.pins);
            if (edu.purchasedCode) setPurchasedCode(edu.purchasedCode);
          }
        } finally {
          setLoadingPayment(false);
        }
      } catch (e: unknown) {
        const em =
          e instanceof Error
            ? e.message
            : "Something went wrong verifying payment.";
        setStatus("failed");
        setMsg(em);
      }
    };

    run();
  }, [sp, router]);

  const title =
    status === "loading"
      ? "Processing..."
      : status === "ok"
      ? "Success"
      : "Failed";

  const showTokenBox =
    status === "ok" &&
    payment?.bill_type === "electricity" &&
    payment?.vend_status === "success" &&
    (!!token || !!units);

  const showPinsBox =
    status === "ok" &&
    payment?.bill_type === "education" &&
    payment?.vend_status === "success" &&
    (pins.length > 0 || !!purchasedCode);

  const showIntlDelivered =
    status === "ok" &&
    payment?.bill_type === "intl_airtime" &&
    payment?.vend_status === "success";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold mb-2">{title}</h1>

        <p className="text-gray-700">{msg}</p>
        {detail ? <p className="text-sm text-gray-500 mt-2">{detail}</p> : null}

        {loadingPayment ? (
          <div className="mt-4 text-sm text-gray-500">
            Loading receipt details...
          </div>
        ) : null}

        {showTokenBox ? (
          <div className="mt-4 text-left bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-green-800 mb-2">
              Electricity Token Details
            </p>

            {token ? (
              <div className="flex justify-between gap-3">
                <span className="text-green-700">Token</span>
                <span className="font-mono text-green-900 break-all">
                  {token}
                </span>
              </div>
            ) : null}

            {units ? (
              <div className="flex justify-between gap-3 mt-2">
                <span className="text-green-700">Units</span>
                <span className="font-medium text-green-900">{units}</span>
              </div>
            ) : null}

            <p className="text-xs text-green-700 mt-3">
              Save this token. You can also find it later in your transaction
              history.
            </p>
          </div>
        ) : null}

        {showPinsBox ? (
          <div className="mt-4 text-left bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-green-800 mb-2">
              Education PIN Details
            </p>

            {purchasedCode ? (
              <div className="flex justify-between gap-3">
                <span className="text-green-700">Purchased Code</span>
                <span className="font-mono text-green-900 break-all">
                  {purchasedCode}
                </span>
              </div>
            ) : null}

            {pins.length ? (
              <div className="mt-3">
                <p className="text-green-700 mb-2">PIN(s)</p>
                <div className="space-y-2">
                  {pins.map((p, i) => (
                    <div
                      key={`${p}-${i}`}
                      className="font-mono text-green-900 break-all bg-white/60 border border-green-200 rounded-lg p-2"
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-green-700 mt-3">
              Save your PIN(s). You can also find them later in your transaction
              history.
            </p>
          </div>
        ) : null}

        {showIntlDelivered ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 text-left">
            International{" "}
            {payment?.vend_response?.product_type || "airtime/data"} delivered
            successfully ✅
          </div>
        ) : null}

        {(gateway || reference) && (
          <div className="mt-4 text-left bg-gray-50 border rounded-xl p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Gateway</span>
              <span className="font-medium text-gray-800">
                {gateway || "-"}
              </span>
            </div>
            <div className="flex justify-between gap-3 mt-2">
              <span className="text-gray-500">Reference</span>
              <span className="font-mono text-gray-800 break-all">
                {reference || "-"}
              </span>
            </div>

            {payment ? (
              <>
                <div className="flex justify-between gap-3 mt-2">
                  <span className="text-gray-500">Bill Type</span>
                  <span className="font-medium text-gray-800">
                    {payment.bill_type}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-2">
                  <span className="text-gray-500">Vend Status</span>
                  <span className="font-medium text-gray-800">
                    {payment.vend_status || "-"}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex">
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="w-full rounded-xl border py-3 font-semibold text-gray-800 hover:bg-gray-50"
          >
            Back Home
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          This page will stay open until you close it or navigate away.
        </p>
      </div>
    </div>
  );
}
