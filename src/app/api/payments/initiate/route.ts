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

/** ------------------ SEERBIT FIX (REAL TOKEN) ------------------ **/

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
    out?.data?.EncrytedSecKey?.encryptedKey || // typo variant seen in some payloads
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

function seerbitAmountString(paidAmount: number) {
  const amt = Number(paidAmount);
  if (!Number.isFinite(amt) || amt <= 0) return "0.00";
  return amt.toFixed(2);
}

/** ------------------------------------------------------------- **/

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as InitiateBody;

    const billType = s(body?.billType);
    const gateway = s(body?.gateway).toLowerCase() as Gateway;
    const paidAmount = n(body?.amount);

    if (!billType || !gateway || !paidAmount) {
      return NextResponse.json(
        { error: "Missing required fields: billType, gateway, amount" },
        { status: 400 }
      );
    }

    if (!["paystack", "flutterwave", "seerbit"].includes(gateway)) {
      return NextResponse.json(
        { error: `Unsupported gateway: ${gateway}` },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "Missing/invalid phone number (customer_phone)" },
        { status: 400 }
      );
    }

    const emailForGateway = fallbackEmailFromPhone(customer_phone);
    const reference = makeReference(billType);

    const network = s(incoming?.network).toLowerCase();
    const dataServiceID = NETWORK_TO_VTPASS_SERVICE_ID[network];

    const normalizedPayload =
      billType === "data"
        ? {
            phone: s(incoming?.phone),
            network,
            serviceID: s(incoming?.serviceID) || s(dataServiceID),

            plan_code: s(
              incoming?.plan_code || incoming?.planId || incoming?.variation_code
            ),
            planId: s(
              incoming?.planId || incoming?.plan_code || incoming?.variation_code
            ),
            ck_plan_code: s(incoming?.ck_plan_code),

            amount: paidAmount,

            plan_name: s(incoming?.plan_name || incoming?.planName || incoming?.name),
            validity: s(incoming?.validity) || "—",
          }
        : billType === "airtime"
        ? {
            phone: s(incoming?.phone),
            network,
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
            amount: n(incoming?.amount),
            totalAmount: n(incoming?.totalAmount ?? paidAmount),
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
            amount: n(incoming?.amount),
            totalAmount: n(incoming?.totalAmount ?? paidAmount),
          }
        : billType === "education"
        ? {
            serviceID: s(incoming?.serviceID || incoming?.educationService),
            variation_code: s(incoming?.variation_code || incoming?.educationPackage),
            phone: s(incoming?.phone),
            contact: s(incoming?.contact),
            quantity: n(incoming?.quantity || 1),
            amount: n(incoming?.amount),
            totalAmount: n(incoming?.totalAmount ?? paidAmount),
          }
        : billType === "showmax"
        ? {
            serviceID: "showmax",
            variation_code: s(incoming?.variation_code || incoming?.plan_code),
            billersCode: s(incoming?.billersCode || incoming?.phone),
            contact: s(incoming?.contact),
            amount: n(incoming?.amount),
            totalAmount: n(incoming?.totalAmount ?? paidAmount),
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
            amount: n(incoming?.amount),

            email: emailForGateway,
          }
        : incoming ?? {};

    // Cross-cutting validations
    if (billType === "airtime") {
      if (!normalizedPayload.phone)
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
      if (!normalizedPayload.network)
        return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
      if ((normalizedPayload as any).amount !== paidAmount) {
        return NextResponse.json({ error: "Airtime amount mismatch" }, { status: 400 });
      }
    }

    if (billType === "data") {
      if (!normalizedPayload.phone)
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
      if (!normalizedPayload.network)
        return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
      if (!(normalizedPayload as any).serviceID)
        return NextResponse.json(
          { error: `Unsupported network: ${(normalizedPayload as any).network}` },
          { status: 400 }
        );
      if (!(normalizedPayload as any).plan_code)
        return NextResponse.json({ error: "Missing payload.plan_code" }, { status: 400 });
      if (!(normalizedPayload as any).plan_name)
        return NextResponse.json({ error: "Missing payload.plan_name" }, { status: 400 });
      if (!(normalizedPayload as any).ck_plan_code) {
        return NextResponse.json(
          { error: "Missing payload.ck_plan_code (required for fallback)" },
          { status: 400 }
        );
      }
      if ((normalizedPayload as any).amount !== paidAmount) {
        return NextResponse.json({ error: "Data amount mismatch" }, { status: 400 });
      }
    }

    const vendAmount = n((normalizedPayload as any)?.amount);
    if (["cable", "electricity", "education", "showmax", "intl_airtime"].includes(billType)) {
      if (!vendAmount || vendAmount <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }
      if (vendAmount > paidAmount) {
        return NextResponse.json(
          { error: "payload.amount cannot exceed request.amount" },
          { status: 400 }
        );
      }
    }

    // Bill-type specifics
    if (billType === "cable") {
      const p: any = normalizedPayload;
      if (!p.provider)
        return NextResponse.json({ error: "Missing payload.provider" }, { status: 400 });
      if (!p.smartcardNumber || p.smartcardNumber.length < 6)
        return NextResponse.json({ error: "Invalid payload.smartcardNumber" }, { status: 400 });
      if (!p.bouquet)
        return NextResponse.json({ error: "Missing payload.bouquet" }, { status: 400 });
      if (!p.phone || p.phone.length < 10)
        return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
      if (!p.customerName)
        return NextResponse.json({ error: "Missing payload.customerName" }, { status: 400 });
    }

    if (billType === "electricity") {
      const p: any = normalizedPayload;
      if (!p.serviceID)
        return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!p.meterType)
        return NextResponse.json({ error: "Missing payload.meterType" }, { status: 400 });
      if (!p.meterNumber)
        return NextResponse.json({ error: "Missing payload.meterNumber" }, { status: 400 });
      if (!p.phone)
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
    }

    if (billType === "education") {
      const p: any = normalizedPayload;
      if (!p.serviceID)
        return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!p.variation_code)
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!p.phone)
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
    }

    if (billType === "showmax") {
      const p: any = normalizedPayload;
      if (!p.variation_code)
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!p.billersCode || String(p.billersCode).length < 10) {
        return NextResponse.json(
          { error: "Missing/invalid payload.billersCode" },
          { status: 400 }
        );
      }
    }

    if (billType === "intl_airtime") {
      const p: any = normalizedPayload;
      if (!p.serviceID)
        return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!allowedIntl.has(String(p.serviceID).trim())) {
        return NextResponse.json(
          { error: `Invalid payload.serviceID: "${p.serviceID}"` },
          { status: 400 }
        );
      }
      if (!p.email)
        return NextResponse.json({ error: "Missing payload.email" }, { status: 400 });
      if (!p.country_code)
        return NextResponse.json({ error: "Missing payload.country_code" }, { status: 400 });
      if (!p.country)
        return NextResponse.json({ error: "Missing payload.country" }, { status: 400 });
      if (!p.product_type_id)
        return NextResponse.json({ error: "Missing payload.product_type_id" }, { status: 400 });
      if (!p.operator_id)
        return NextResponse.json({ error: "Missing payload.operator_id" }, { status: 400 });
      if (!p.operator)
        return NextResponse.json({ error: "Missing payload.operator" }, { status: 400 });
      if (!p.variation_code)
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!p.billersCode || String(p.billersCode).length < 10) {
        return NextResponse.json(
          { error: "Missing/invalid payload.billersCode" },
          { status: 400 }
        );
      }
      if (!p.phone || String(p.phone).length < 10) {
        return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
      }
    }

    // Store payment row
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
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is missing in env" },
        { status: 500 }
      );
    }

    const callbackUrl = `${siteUrl}/payment/callback?gateway=${gateway}&reference=${reference}`;

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
            payload: normalizedPayload,
            is_guest: isGuest,
            customer_phone,
          },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: (out as any)?.message || "Paystack init failed", raw: out },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { type: "redirect", redirectUrl: (out as any)?.data?.authorization_url ?? null, reference },
        { status: 200 }
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
          meta: {
            billType,
            payload: normalizedPayload,
            is_guest: isGuest,
            customer_phone,
          },
          customizations: { title: "PayNow", description: "Bill payment" },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || (out as any)?.status !== "success") {
        return NextResponse.json(
          { error: (out as any)?.message || "Flutterwave init failed", raw: out },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { type: "redirect", redirectUrl: (out as any)?.data?.link ?? null, reference },
        { status: 200 }
      );
    }

    // SEERBIT (FIXED TOKEN FLOW)
    if (gateway === "seerbit") {
      const productId = String(process.env.SEERBIT_PRODUCT_ID || "").trim();
      if (!productId) {
        return NextResponse.json(
          { error: "Missing SEERBIT_PRODUCT_ID in env" },
          { status: 500 }
        );
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
          paymentReference: reference, // this is what you MUST verify with
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

      // store init response for debugging (optional but recommended)
      await supabaseAdmin
        .from("payments")
        .update({ gateway_init_response: out })
        .eq("reference", reference);

      if (!res.ok) {
        return NextResponse.json(
          { error: out?.message || out?.data?.message || "SeerBit init failed", raw: out },
          { status: 400 }
        );
      }

      const redirectUrl =
        out?.data?.payments?.redirectLink ||
        out?.data?.paymentLink ||
        out?.data?.link ||
        null;

      if (!redirectUrl) {
        return NextResponse.json(
          { error: "SeerBit did not return redirectLink", raw: out },
          { status: 400 }
        );
      }

      return NextResponse.json({ type: "redirect", redirectUrl, reference }, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
