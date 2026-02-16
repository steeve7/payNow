// app/api/payments/initiate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

const allowedIntl = new Set(["foreign-airtime", "foreign-data", "foreign-pin"]);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getIncoming(body: any) {
  return body?.meta && typeof body.meta === "object"
    ? { ...body, ...body.meta }
    : body;
}

function s(v: any) {
  return String(v ?? "").trim();
}
function n(v: any) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}
function digits(v: any) {
  return String(v ?? "").replace(/\D/g, "");
}
function mustString(v: any) {
  return String(v ?? "").trim();
}

function makeReference(prefix = "paynow") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fallbackEmailFromPhone(phoneRaw: any) {
  const phone = digits(phoneRaw);
  const safe = phone || "guest";
  return `guest_${safe}@paynow.ng`;
}

const NETWORK_TO_VTPASS_SERVICE_ID: Record<string, string> = {
  mtn: "mtn-data",
  airtel: "airtel-data",
  glo: "glo-data",
  "9mobile": "9mobile-data",
};

type Gateway = "paystack" | "flutterwave" | "seerbit";

type InitiateBody = {
  billType: string;
  gateway: Gateway;
  amount: number | string;
  meta?: any;
  payload?: any;
  customer_phone?: string;
};

/** ------------------ SEERBIT (REAL TOKEN) ------------------ **/

let SEERBIT_ENCRYPTED_KEY: string | null = null;
let SEERBIT_KEY_FETCHED_AT = 0;
const SEERBIT_TOKEN_TTL_MS = 50 * 60 * 1000;

function mustEnv(name: string) {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`Missing ${name} in env`);
  return v;
}

async function getSeerbitBearerToken() {
  if (
    SEERBIT_ENCRYPTED_KEY &&
    Date.now() - SEERBIT_KEY_FETCHED_AT < SEERBIT_TOKEN_TTL_MS
  ) {
    return SEERBIT_ENCRYPTED_KEY;
  }

  const publicKey = mustEnv("SEERBIT_PUBLIC_KEY");
  const privateKey = mustEnv("SEERBIT_PRIVATE_KEY");

  const res = await fetch("https://seerbitapi.com/api/v2/encrypt/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ key: `${privateKey}.${publicKey}` }),
  });

  const out = await res.json().catch(() => ({} as any));

  const encryptedKey =
    out?.data?.EncrytedSecKey?.encryptedKey ||
    out?.data?.EncryptedSecKey?.encryptedKey ||
    out?.data?.encryptedKey ||
    null;

  if (!res.ok || !encryptedKey) {
    throw new Error(
      out?.message ||
        out?.data?.message ||
        out?.error ||
        "Failed to generate SeerBit encrypted key"
    );
  }

  SEERBIT_ENCRYPTED_KEY = String(encryptedKey).trim();
  SEERBIT_KEY_FETCHED_AT = Date.now();
  return SEERBIT_ENCRYPTED_KEY;
}

function seerbitAmountString(amountNgn: number) {
  const amt = Number(amountNgn);
  if (!Number.isFinite(amt) || amt <= 0) return "0.00";
  return amt.toFixed(2);
}

/** ------------------ SECURITY HELPERS ------------------ **/

const MIN_NGN = 100;        // global min
const MAX_NGN = 500_000;    // optional safety cap (adjust if needed)

function assertAmountRange(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "Invalid amount";
  if (amount < MIN_NGN) return `Minimum amount is ₦${MIN_NGN}`;
  if (amount > MAX_NGN) return `Amount too large (max ₦${MAX_NGN})`;
  return "";
}

function normalizeNetwork(net: string) {
  const x = s(net).toLowerCase();
  if (x === "9mobile" || x === "etisalat") return "9mobile";
  return x;
}

// Parse something like "14999.91" => 15000
function parseMoneyLike(v: any) {
  const x = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.round(x);
}

// Fallback parse: find "15,000" from plan_name string
function parseAmountFromText(text: any) {
  const t = String(text ?? "");
  // capture last big number like 15,000 or 15000
  const m = t.match(/(\d[\d,]{2,})\s*naira/i) || t.match(/(\d[\d,]{2,})/);
  if (!m) return 0;
  const val = Number(String(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.round(val);
}

function noCacheJson(body: any, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** ------------------------------------------------------ **/

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as InitiateBody;

    const billType = s(body?.billType);
    const gateway = s(body?.gateway).toLowerCase() as Gateway;

    // client sends amount, but we now validate hard
    const paidAmount = n(body?.amount);

    if (!billType || !gateway || !paidAmount) {
      return noCacheJson(
        { error: "Missing required fields: billType, gateway, amount" },
        400
      );
    }

    if (!["paystack", "flutterwave", "seerbit"].includes(gateway)) {
      return noCacheJson({ error: `Unsupported gateway: ${gateway}` }, 400);
    }

    // GLOBAL AMOUNT GUARD (prevents ₦15)
    const rangeErr = assertAmountRange(paidAmount);
    if (rangeErr) return noCacheJson({ error: rangeErr }, 400);

    // Optional auth (guest allowed)
    let authedUserId: string | null = null;

    const authHeader = req.headers.get("authorization") || "";
    const authAccessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (authAccessToken) {
      const { data: u } = await supabaseAdmin.auth.getUser(authAccessToken);
      authedUserId = u?.user?.id ?? null;
    } else {
      try {
        const supabase = await createSupabaseServerClient();
        const { data: u } = await supabase.auth.getUser();
        authedUserId = u?.user?.id ?? null;
      } catch {
        authedUserId = null;
      }
    }

    const isGuest = !authedUserId;

    const mergedBody = getIncoming(body);
    const incoming = getIncoming({
      ...(mergedBody && typeof mergedBody === "object" ? mergedBody : {}),
      ...(body?.meta && typeof body.meta === "object" ? body.meta : {}),
      ...(body?.payload && typeof body.payload === "object" ? body.payload : {}),
    });

    // phone identity (primary)
    const customerPhone =
      s(body?.customer_phone) ||
      s(incoming?.phone) ||
      s(incoming?.phoneNumber) ||
      s(incoming?.billersCode) ||
      s(incoming?.meterNumber) ||
      "";

    const customer_phone = digits(customerPhone);

    if (!customer_phone || customer_phone.length < 10) {
      return noCacheJson(
        { error: "Missing/invalid phone number (customer_phone)" },
        400
      );
    }

    const emailForGateway = fallbackEmailFromPhone(customer_phone);
    const reference = makeReference(billType);

    const network = normalizeNetwork(incoming?.network);
    const dataServiceID = NETWORK_TO_VTPASS_SERVICE_ID[network];

    // Build normalizedPayload where the server locks amounts
    const normalizedPayload =
      billType === "data"
        ? {
            phone: s(incoming?.phone),
            network,
            serviceID: s(incoming?.serviceID) || s(dataServiceID),

            plan_code: s(incoming?.plan_code || incoming?.planId || incoming?.variation_code),
            planId: s(incoming?.planId || incoming?.plan_code || incoming?.variation_code),

            // client-sent price hint; we validate it strictly below
            ck_plan_code: s(incoming?.ck_plan_code),

            // SERVER LOCKED:
            amount: paidAmount,

            plan_name: s(incoming?.plan_name || incoming?.planName || incoming?.name),
            validity: s(incoming?.validity) || "—",
          }
        : billType === "airtime"
        ? {
            phone: s(incoming?.phone),
            network,
            // SERVER LOCKED:
            amount: paidAmount,
          }
        : billType === "cable"
        ? {
            provider: s(incoming?.provider).toLowerCase(),
            smartcardNumber: s(incoming?.smartcardNumber || incoming?.billersCode),
            bouquet: s(incoming?.bouquet || incoming?.variation_code),
            phone: s(incoming?.phone || incoming?.phoneNumber),
            months: n(incoming?.months || 1),
            contact: s(incoming?.contact),
            // SERVER LOCKED:
            amount: paidAmount,
            totalAmount: paidAmount,
            customerName: s(
              incoming?.customerName ||
                incoming?.customer_name ||
                incoming?.verifiedCustomerName ||
                ""
            ),
          }
        : billType === "electricity"
        ? {
            provider: s(incoming?.provider),
            providerLabel: s(incoming?.providerLabel),
            serviceID: s(incoming?.serviceID),
            meterType: s(incoming?.meterType).toLowerCase(),
            meterNumber: s(incoming?.meterNumber),
            customerName: s(incoming?.customerName),
            phone: s(incoming?.phone),
            contact: s(incoming?.contact),
            // SERVER LOCKED:
            amount: paidAmount,
            totalAmount: paidAmount,
          }
        : billType === "education"
        ? {
            serviceID: s(incoming?.serviceID || incoming?.educationService),
            variation_code: s(incoming?.variation_code || incoming?.educationPackage),
            phone: s(incoming?.phone),
            contact: s(incoming?.contact),
            quantity: n(incoming?.quantity || 1),
            // SERVER LOCKED:
            amount: paidAmount,
            totalAmount: paidAmount,
          }
        : billType === "showmax"
        ? {
            serviceID: "showmax",
            variation_code: s(incoming?.variation_code || incoming?.plan_code),
            billersCode: s(incoming?.billersCode || incoming?.phone),
            contact: s(incoming?.contact),
            // SERVER LOCKED:
            amount: paidAmount,
            totalAmount: paidAmount,
          }
        : billType === "intl_airtime"
        ? {
            serviceID: mustString(incoming?.serviceID),
            country_code: mustString(incoming?.country_code).toUpperCase(),
            country: mustString(incoming?.country),

            operator_id: mustString(incoming?.operator_id),
            operator: mustString(incoming?.operator),

            product_type_id: mustString(incoming?.product_type_id),
            variation_code: mustString(incoming?.variation_code),

            billersCode: digits(incoming?.billersCode),
            phone: digits(incoming?.phone),

            contact: mustString(incoming?.contact),

            // SERVER LOCKED:
            amount: paidAmount,
            totalAmount: paidAmount,

            email: emailForGateway,
          }
        : incoming ?? {};

    /** ------------------ VALIDATIONS (HARD) ------------------ **/

    // Common: ensure the server-locked payload.amount equals paidAmount for all types
    const lockedAmount = n((normalizedPayload as any)?.amount);
    if (lockedAmount !== paidAmount) {
      return noCacheJson({ error: "Amount lock mismatch (server)" }, 400);
    }

    // AIRTIME
    if (billType === "airtime") {
      const p: any = normalizedPayload;

      if (!p.phone || digits(p.phone).length < 10)
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);

      if (!p.network || !NETWORK_TO_VTPASS_SERVICE_ID[p.network.replace("-data", "")] && !["mtn","airtel","glo","9mobile"].includes(p.network))
        return noCacheJson({ error: "Missing/invalid payload.network" }, 400);

      //  amount already locked to paidAmount and validated >= 100
    }

    // DATA
    if (billType === "data") {
      const p: any = normalizedPayload;

      if (!p.phone || digits(p.phone).length < 10)
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);

      if (!p.network)
        return noCacheJson({ error: "Missing payload.network" }, 400);

      if (!p.serviceID)
        return noCacheJson({ error: `Unsupported network: ${p.network}` }, 400);

      if (!p.plan_code)
        return noCacheJson({ error: "Missing payload.plan_code" }, 400);

      if (!p.plan_name)
        return noCacheJson({ error: "Missing payload.plan_name" }, 400);

      // HARD PRICE MATCH
      // Priority: ck_plan_code -> plan_name parsed
      const expectedFromCk = parseMoneyLike(p.ck_plan_code);
      const expectedFromName = parseAmountFromText(p.plan_name);

      const expected =
        expectedFromCk > 0
          ? expectedFromCk
          : expectedFromName > 0
          ? expectedFromName
          : 0;

      if (!expected) {
        return noCacheJson(
          { error: "Unable to validate plan price (missing/invalid plan price)" },
          400
        );
      }

      if (paidAmount !== expected) {
        return noCacheJson(
          {
            error: `Amount mismatch for selected plan. Expected ₦${expected}, got ₦${paidAmount}.`,
          },
          400
        );
      }
    }

    // CABLE
    if (billType === "cable") {
      const p: any = normalizedPayload;

      if (!p.provider) return noCacheJson({ error: "Missing payload.provider" }, 400);

      if (!p.smartcardNumber || p.smartcardNumber.length < 6)
        return noCacheJson({ error: "Invalid payload.smartcardNumber" }, 400);

      if (!p.bouquet) return noCacheJson({ error: "Missing payload.bouquet" }, 400);

      if (!p.phone || digits(p.phone).length < 10)
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);

      if (!p.customerName)
        return noCacheJson({ error: "Missing payload.customerName" }, 400);

      // amount already locked
      // Optional: months must be 1..12
      if (!Number.isFinite(p.months) || p.months < 1 || p.months > 12) {
        return noCacheJson({ error: "Invalid payload.months" }, 400);
      }
    }

    // ELECTRICITY
    if (billType === "electricity") {
      const p: any = normalizedPayload;

      if (!p.serviceID) return noCacheJson({ error: "Missing payload.serviceID" }, 400);

      const mt = s(p.meterType).toLowerCase();
      if (!["prepaid", "postpaid"].includes(mt)) {
        return noCacheJson({ error: "Invalid payload.meterType (prepaid/postpaid)" }, 400);
      }

      if (!p.meterNumber || digits(p.meterNumber).length < 6)
        return noCacheJson({ error: "Missing/invalid payload.meterNumber" }, 400);

      if (!p.phone || digits(p.phone).length < 10)
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);
    }

    // EDUCATION
    if (billType === "education") {
      const p: any = normalizedPayload;

      if (!p.serviceID) return noCacheJson({ error: "Missing payload.serviceID" }, 400);
      if (!p.variation_code) return noCacheJson({ error: "Missing payload.variation_code" }, 400);

      if (!p.phone || digits(p.phone).length < 10)
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);

      const qty = Number(p.quantity || 1);
      if (!Number.isFinite(qty) || qty < 1 || qty > 10) {
        return noCacheJson({ error: "Invalid payload.quantity" }, 400);
      }
    }

    // SHOWMAX
    if (billType === "showmax") {
      const p: any = normalizedPayload;

      if (!p.variation_code)
        return noCacheJson({ error: "Missing payload.variation_code" }, 400);

      if (!p.billersCode || String(p.billersCode).length < 10) {
        return noCacheJson({ error: "Missing/invalid payload.billersCode" }, 400);
      }
    }

    // INTL AIRTIME
    if (billType === "intl_airtime") {
      const p: any = normalizedPayload;

      if (!p.serviceID) return noCacheJson({ error: "Missing payload.serviceID" }, 400);
      if (!allowedIntl.has(String(p.serviceID).trim())) {
        return noCacheJson({ error: `Invalid payload.serviceID: "${p.serviceID}"` }, 400);
      }

      if (!p.email) return noCacheJson({ error: "Missing payload.email" }, 400);
      if (!p.country_code) return noCacheJson({ error: "Missing payload.country_code" }, 400);
      if (!p.country) return noCacheJson({ error: "Missing payload.country" }, 400);
      if (!p.product_type_id) return noCacheJson({ error: "Missing payload.product_type_id" }, 400);
      if (!p.operator_id) return noCacheJson({ error: "Missing payload.operator_id" }, 400);
      if (!p.operator) return noCacheJson({ error: "Missing payload.operator" }, 400);
      if (!p.variation_code) return noCacheJson({ error: "Missing payload.variation_code" }, 400);

      if (!p.billersCode || String(p.billersCode).length < 10) {
        return noCacheJson({ error: "Missing/invalid payload.billersCode" }, 400);
      }
      if (!p.phone || String(p.phone).length < 10) {
        return noCacheJson({ error: "Missing/invalid payload.phone" }, 400);
      }
    }

    /** ------------------ STORE PAYMENT ROW ------------------ **/

    const { error: insErr } = await supabaseAdmin.from("payments").insert({
      user_id: authedUserId,
      is_guest: isGuest,
      customer_phone,
      bill_type: billType,
      gateway,
      amount: paidAmount,
      currency: "NGN",
      status: "pending",
      reference,
      payload: normalizedPayload,
      vend_status: "pending",
      vend_attempts: 0,
    });

    if (insErr) {
      return noCacheJson({ error: insErr.message }, 500);
    }

    /** ------------------ CALLBACK URL ------------------ **/
    const host = req.headers.get("host") || "";
    const isLocal =
      process.env.NODE_ENV === "development" || host.includes("localhost");

    const siteUrl = isLocal
      ? "http://localhost:3000"
      : (process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`).replace(/\/+$/, "");

    if (!siteUrl) {
      return noCacheJson({ error: "Unable to determine site url" }, 500);
    }

    const callbackUrl = `${siteUrl}/payment/callback?gateway=${gateway}&reference=${reference}`;

    /** ------------------ GATEWAYS ------------------ **/

    // PAYSTACK
    if (gateway === "paystack") {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailForGateway,
          amount: Math.round(paidAmount * 100),
          reference,
          callback_url: callbackUrl,
          metadata: {
            billType,
            is_guest: isGuest,
            customer_phone,
          },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return noCacheJson(
          { error: (out as any)?.message || "Paystack init failed", raw: out },
          400
        );
      }

      return noCacheJson(
        { type: "redirect", redirectUrl: (out as any)?.data?.authorization_url ?? null, reference },
        200
      );
    }

    // FLUTTERWAVE
    if (gateway === "flutterwave") {
      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: paidAmount,
          currency: "NGN",
          redirect_url: callbackUrl,
          customer: { email: emailForGateway },
          meta: { billType, is_guest: isGuest, customer_phone },
          customizations: { title: "PayNow", description: "Bill payment" },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || (out as any)?.status !== "success") {
        return noCacheJson(
          { error: (out as any)?.message || "Flutterwave init failed", raw: out },
          400
        );
      }

      return noCacheJson(
        { type: "redirect", redirectUrl: (out as any)?.data?.link ?? null, reference },
        200
      );
    }

    // SEERBIT
    if (gateway === "seerbit") {
      const productId = String(process.env.SEERBIT_PRODUCT_ID || "").trim();
      if (!productId) {
        return noCacheJson({ error: "Missing SEERBIT_PRODUCT_ID in env" }, 500);
      }

      const publicKey = mustEnv("SEERBIT_PUBLIC_KEY");
      const seerbitBearer = await getSeerbitBearerToken();

      const fullName =
        s((normalizedPayload as any)?.customerName) ||
        s((incoming as any)?.fullName) ||
        "PayNow Customer";

      const res = await fetch("https://seerbitapi.com/api/v2/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${seerbitBearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicKey,
          amount: seerbitAmountString(paidAmount),
          currency: "NGN",
          country: "NG",
          paymentReference: reference,
          email: emailForGateway,
          fullName,
          productId,
          productDescription: `PayNow ${billType} payment`,
          callbackUrl,
          paymentType: "CARD",
          metadata: { billType, is_guest: isGuest, customer_phone },
        }),
      });

      const out = await res.json().catch(() => ({} as any));

      await supabaseAdmin
        .from("payments")
        .update({ gateway_init_response: out })
        .eq("reference", reference);

      if (!res.ok) {
        return noCacheJson(
          { error: out?.message || out?.data?.message || "SeerBit init failed", raw: out },
          400
        );
      }

      const redirectUrl =
        out?.data?.payments?.redirectLink ||
        out?.data?.paymentLink ||
        out?.data?.link ||
        null;

      if (!redirectUrl) {
        return noCacheJson(
          { error: "SeerBit did not return redirectLink", raw: out },
          400
        );
      }

      return noCacheJson({ type: "redirect", redirectUrl, reference }, 200);
    }

    return noCacheJson({ error: "Unsupported gateway" }, 400);
  } catch (e: any) {
    return noCacheJson({ error: e?.message || "Server error" }, 500);
  }
}
