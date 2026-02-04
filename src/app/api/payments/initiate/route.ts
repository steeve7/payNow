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
  // support both: fields at top-level OR fields inside meta
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

// server-side fallback email (gateway-required)
function fallbackEmailFromPhone(phoneRaw: any) {
  const phone = digits(phoneRaw);
  const safe = phone || "guest";
  return `guest_${safe}@paynow.ng`;
}

// needed for DATA vending (VTPass serviceID)
const NETWORK_TO_VTPASS_SERVICE_ID: Record<string, string> = {
  mtn: "mtn-data",
  airtel: "airtel-data",
  glo: "glo-data",
  "9mobile": "9mobile-data",
};

type Gateway = "paystack" | "flutterwave" | "korapay" | "interswitch";

type InitiateBody = {
  billType: string;
  gateway: Gateway;
  amount: number | string; // PAID AMOUNT (what you charge)
  // email removed from required fields
  meta?: any;
  payload?: any;

  // optional (frontend can send it, but not required)
  customer_phone?: string;
};

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

    if (!["paystack", "flutterwave", "korapay", "interswitch"].includes(gateway)) {
      return NextResponse.json(
        { error: `Unsupported gateway: ${gateway}` },
        { status: 400 }
      );
    }

    // Optional auth (guest allowed)
    let authedUserId: string | null = null;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (token) {
      const { data: u } = await supabaseAdmin.auth.getUser(token);
      authedUserId = u?.user?.id ?? null;
    } else {
      // cookie auth (if present). If missing -> proceed as guest.
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

    // email only for gateways that require it (generated)
    const emailForGateway = fallbackEmailFromPhone(customer_phone);

    const reference = makeReference(billType);

    const network = s(incoming?.network).toLowerCase();
    const dataServiceID = NETWORK_TO_VTPASS_SERVICE_ID[network];

    /**
     * IMPORTANT SECURITY PRINCIPLE
     * - We DO NOT allow incoming/meta/payload to set a vend amount bigger than paidAmount.
     * - For airtime & data, we force vendAmount === paidAmount.
     * - For other bill types, vendAmount can be incoming.amount but must be <= paidAmount.
     */
    const normalizedPayload =
      billType === "data"
        ? {
            phone: s(incoming?.phone),
            network,
            serviceID: s(incoming?.serviceID) || s(dataServiceID),

            plan_code: s(incoming?.plan_code || incoming?.planId || incoming?.variation_code),
            planId: s(incoming?.planId || incoming?.plan_code || incoming?.variation_code),
            ck_plan_code: s(incoming?.ck_plan_code),

            // FORCE vend amount to paid amount
            amount: paidAmount,

            plan_name: s(incoming?.plan_name || incoming?.planName || incoming?.name),
            validity: s(incoming?.validity) || "—",
          }
        : billType === "airtime"
        ? {
            phone: s(incoming?.phone),
            network,
            // FORCE vend amount to paid amount
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

            // still required by vendIntAirtime, but generated
            email: emailForGateway,
          }
        : incoming ?? {};

    // Cross-cutting validations (per bill type)
    if (billType === "airtime") {
      if (!normalizedPayload.phone) return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
      if (!normalizedPayload.network) return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
      if (normalizedPayload.amount !== paidAmount) {
        return NextResponse.json({ error: "Airtime amount mismatch" }, { status: 400 });
      }
    }

    if (billType === "data") {
      if (!normalizedPayload.phone) return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
      if (!normalizedPayload.network) return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
      if (!normalizedPayload.serviceID) return NextResponse.json({ error: `Unsupported network: ${normalizedPayload.network}` }, { status: 400 });
      if (!normalizedPayload.plan_code) return NextResponse.json({ error: "Missing payload.plan_code" }, { status: 400 });
      if (!normalizedPayload.plan_name) return NextResponse.json({ error: "Missing payload.plan_name" }, { status: 400 });
      if (!normalizedPayload.ck_plan_code) {
        return NextResponse.json({ error: "Missing payload.ck_plan_code (required for fallback)" }, { status: 400 });
      }
      if (normalizedPayload.amount !== paidAmount) {
        return NextResponse.json({ error: "Data amount mismatch" }, { status: 400 });
      }
    }

    // For bill types where vend amount comes from payload, enforce vendAmount <= paidAmount
    const vendAmount = n((normalizedPayload as any)?.amount);
    if (["cable", "electricity", "education", "showmax", "intl_airtime"].includes(billType)) {
      if (!vendAmount || vendAmount <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }
      if (vendAmount > paidAmount) {
        return NextResponse.json({ error: "payload.amount cannot exceed request.amount" }, { status: 400 });
      }
    }

    if (billType === "cable") {
      if (!normalizedPayload.provider) return NextResponse.json({ error: "Missing payload.provider" }, { status: 400 });
      if (!normalizedPayload.smartcardNumber || normalizedPayload.smartcardNumber.length < 6) {
        return NextResponse.json({ error: "Invalid payload.smartcardNumber" }, { status: 400 });
      }
      if (!normalizedPayload.bouquet) return NextResponse.json({ error: "Missing payload.bouquet" }, { status: 400 });
      if (!normalizedPayload.phone || normalizedPayload.phone.length < 10) return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
      if (!normalizedPayload.customerName) return NextResponse.json({ error: "Missing payload.customerName" }, { status: 400 });
    }

    if (billType === "electricity") {
      if (!normalizedPayload.serviceID) return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!normalizedPayload.meterType) return NextResponse.json({ error: "Missing payload.meterType" }, { status: 400 });
      if (!normalizedPayload.meterNumber) return NextResponse.json({ error: "Missing payload.meterNumber" }, { status: 400 });
      if (!normalizedPayload.phone) return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
    }

    if (billType === "education") {
      if (!normalizedPayload.serviceID) return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!normalizedPayload.variation_code) return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!normalizedPayload.phone) return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
    }

    if (billType === "showmax") {
      if (!normalizedPayload.variation_code) return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!normalizedPayload.billersCode || String(normalizedPayload.billersCode).length < 10) {
        return NextResponse.json({ error: "Missing/invalid payload.billersCode" }, { status: 400 });
      }
    }

    if (billType === "intl_airtime") {
      const p = normalizedPayload as any;
      if (!p.serviceID) return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      if (!allowedIntl.has(String(p.serviceID).trim())) {
        return NextResponse.json({ error: `Invalid payload.serviceID: "${p.serviceID}"` }, { status: 400 });
      }
      // we generate emailForGateway, so this is always present
      if (!p.email) return NextResponse.json({ error: "Missing payload.email" }, { status: 400 });
      if (!p.country_code) return NextResponse.json({ error: "Missing payload.country_code" }, { status: 400 });
      if (!p.country) return NextResponse.json({ error: "Missing payload.country" }, { status: 400 });
      if (!p.product_type_id) return NextResponse.json({ error: "Missing payload.product_type_id" }, { status: 400 });
      if (!p.operator_id) return NextResponse.json({ error: "Missing payload.operator_id" }, { status: 400 });
      if (!p.operator) return NextResponse.json({ error: "Missing payload.operator" }, { status: 400 });
      if (!p.variation_code) return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      if (!p.billersCode || String(p.billersCode).length < 10) return NextResponse.json({ error: "Missing/invalid payload.billersCode" }, { status: 400 });
      if (!p.phone || String(p.phone).length < 10) return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
    }

    // Store payment row (NO email column dependency)
    const { error: insErr } = await supabaseAdmin.from("payments").insert({
      user_id: authedUserId, // null allowed for guest
      is_guest: isGuest,     // boolean column (you want this)
      customer_phone,        // phone identity
      bill_type: billType,
      gateway,
      amount: paidAmount,    // PAID AMOUNT (what gateway will charge)
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
      return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is missing in env" }, { status: 500 });
    }

    const callbackUrl = `${siteUrl}/payment/callback?gateway=${gateway}&reference=${reference}`;

    // Gateway initialize (use emailForGateway)
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
          metadata: { billType, payload: normalizedPayload, is_guest: isGuest, customer_phone },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: out?.message || "Paystack init failed", raw: out }, { status: 400 });
      }

      return NextResponse.json(
        { type: "redirect", redirectUrl: out?.data?.authorization_url ?? null, reference },
        { status: 200 }
      );
    }

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
          meta: { billType, payload: normalizedPayload, is_guest: isGuest, customer_phone },
          customizations: { title: "PayNow", description: "Bill payment" },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || out?.status !== "success") {
        return NextResponse.json({ error: out?.message || "Flutterwave init failed", raw: out }, { status: 400 });
      }

      return NextResponse.json(
        { type: "redirect", redirectUrl: out?.data?.link ?? null, reference },
        { status: 200 }
      );
    }

    if (gateway === "korapay") {
      const base = process.env.KORAPAY_BASE_URL || "https://api.korapay.com";
      const endpoint = process.env.KORAPAY_INIT_ENDPOINT || "/merchant/api/v1/charges/initialize";

      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paidAmount,
          currency: "NGN",
          reference,
          redirect_url: callbackUrl,
          customer: { email: emailForGateway },
          metadata: { billType, payload: normalizedPayload, is_guest: isGuest, customer_phone },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: out?.message || "Korapay init failed", raw: out }, { status: 400 });
      }

      const checkoutUrl = out?.data?.checkout_url || out?.data?.checkoutUrl || out?.data?.link;
      if (!checkoutUrl) {
        return NextResponse.json({ error: "Korapay did not return checkout url", raw: out }, { status: 400 });
      }

      return NextResponse.json({ type: "redirect", redirectUrl: checkoutUrl, reference }, { status: 200 });
    }

    if (gateway === "interswitch") {
      const env = process.env.INTERSWITCH_ENV || "TEST";
      const actionUrl =
        env === "LIVE"
          ? "https://newwebpay.interswitchng.com/collections/w/pay"
          : "https://newwebpay.qa.interswitchng.com/collections/w/pay";

      const merchantCode = process.env.INTERSWITCH_MERCHANT_CODE!;
      const payItemId = process.env.INTERSWITCH_PAY_ITEM_ID!;
      const amountKobo = Math.round(paidAmount * 100);

      return NextResponse.json(
        {
          type: "form_post",
          reference,
          actionUrl,
          fields: {
            merchant_code: merchantCode,
            pay_item_id: payItemId,
            txn_ref: reference,
            amount: String(amountKobo),
            currency: "566",
            site_redirect_url: callbackUrl,
            cust_email: emailForGateway, // required by interswitch form
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
