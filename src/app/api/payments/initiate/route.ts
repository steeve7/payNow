// app/api/payments/initiate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

const allowed = new Set(["foreign-airtime", "foreign-data", "foreign-pin"]);

function getIncoming(body: any) {
  // support both:
  // - new shape: fields at top-level
  // - old shape: fields inside meta
  return body?.meta && typeof body.meta === "object" ? { ...body, ...body.meta } : body;
}

function s(v: any) {
  return String(v ?? "").trim();
}

function n(v: any) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}


function mustString(v: any) {
  return String(v ?? "").trim();
}

function digits(v: any) {
  return String(v ?? "").replace(/\D/g, "");
}


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function makeReference(prefix = "paynow") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ✅ needed for DATA vending (VTPass serviceID)
const NETWORK_TO_VTPASS_SERVICE_ID: Record<string, string> = {
  mtn: "mtn-data",
  airtel: "airtel-data",
  glo: "glo-data",
  "9mobile": "9mobile-data",
};

type InitiateBody = {
  billType: string;
  gateway: "paystack" | "flutterwave" | "korapay" | "interswitch";
  amount: number | string;
  email: string;
  meta?: any;
  payload?: any;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InitiateBody;
    const { billType, gateway, amount, email, meta, payload } = body;
    const mergedBody = getIncoming(body);


    if (!billType || !gateway || !amount || !email) {
      return NextResponse.json(
        { error: "Missing required fields: billType, gateway, amount, email" },
        { status: 400 }
      );
    }

    // ✅ AUTH: Prefer Bearer token. Fallback to cookie auth.
    let authedUserId: string | null = null;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (token) {
      const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 401 });
      authedUserId = u?.user?.id ?? null;
    } else {
      const supabase = await createSupabaseServerClient();
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 401 });
      authedUserId = u?.user?.id ?? null;
    }

    if (!authedUserId) {
      return NextResponse.json({ error: "Auth session missing." }, { status: 401 });
    }

    const reference = makeReference(billType);

   // ✅ Normalize payload (we store in payments.payload for verify/vend)
    // Prefer payload/meta if provided, but always merge with top-level so data fields are not lost.
    const baseIncoming = payload ?? meta ?? mergedBody ?? {};
    const incoming = getIncoming(baseIncoming);

    const network = String(incoming?.network || "").toLowerCase();
    const dataServiceID = NETWORK_TO_VTPASS_SERVICE_ID[network];

    const normalizedPayload =
     billType === "data"
  ? {
      phone: s(incoming?.phone),
      network: s(incoming?.network).toLowerCase(),

      // ✅ accept either incoming.serviceID or derive it
      serviceID: s(incoming?.serviceID) || s(dataServiceID),

      plan_code: s(incoming?.plan_code || incoming?.planId || incoming?.variation_code),
      planId: s(incoming?.planId || incoming?.plan_code || incoming?.variation_code),
      amount: n(incoming?.amount ?? amount),

      // ✅ receipts
      plan_name: s(incoming?.plan_name || incoming?.planName || incoming?.name),
      validity: s(incoming?.validity) || "—",
    }

        : billType === "airtime"
        ? {
            phone: String(incoming?.phone || ""),
            network,
            amount: Number(incoming?.amount ?? amount),
          }
       : billType === "cable"
    ? {
        provider: String(incoming?.provider || "").toLowerCase(),
        smartcardNumber: String(
          incoming?.smartcardNumber || incoming?.billersCode || ""
        ).trim(),
        bouquet: String(incoming?.bouquet || incoming?.variation_code || "").trim(),
        phone: String(incoming?.phone || incoming?.phoneNumber || "").trim(), //  REQUIRED
        months: Number(incoming?.months || 1),
        contact: String(incoming?.contact || "").trim(), //  optional but store
        amount: Number(incoming?.amount ?? 0), // REQUIRED (bill amount)
        totalAmount: Number(incoming?.totalAmount ?? amount), //  REQUIRED (charged amount)
        // ✅ NEW: save verified name for receipt
      customerName: String(
        incoming?.customerName ||
          incoming?.customer_name ||
          incoming?.verifiedCustomerName ||
          ""
      ).trim(),
      }
        : billType === "electricity"
          ? {
              provider: String(incoming?.provider || ""),
              providerLabel: String(incoming?.providerLabel || ""),
              serviceID: String(incoming?.serviceID || ""),
              meterType: String(incoming?.meterType || "").toLowerCase(), // prepaid/postpaid
              meterNumber: String(incoming?.meterNumber || ""),
              customerName: String(incoming?.customerName || ""),
              phone: String(incoming?.phone || ""),
              contact: String(incoming?.contact || ""),
              amount: Number(incoming?.amount ?? amount),
              totalAmount: Number(incoming?.totalAmount ?? amount),
            }
            : billType === "education"
              ? {
                  serviceID: String(incoming?.serviceID || incoming?.educationService || ""),
                  variation_code: String(incoming?.variation_code || incoming?.educationPackage || ""),
                  phone: String(incoming?.phone || ""),
                  contact: String(incoming?.contact || ""),
                  quantity: Number(incoming?.quantity || 1),
                  amount: Number(incoming?.amount ?? amount),
                  totalAmount: Number(incoming?.totalAmount ?? amount),
                }
                : billType === "showmax"
              ? {
                  serviceID: "showmax",
                  variation_code: String(incoming?.variation_code || incoming?.plan_code || "").trim(),
                  billersCode: String(incoming?.billersCode || incoming?.phone || "").trim(), // required by VTPass showmax
                  contact: String(incoming?.contact || "").trim(),
                  amount: Number(incoming?.amount ?? amount),
                  totalAmount: Number(incoming?.totalAmount ?? amount),
                }
          : billType === "intl_airtime"
    ? {
        serviceID: mustString(incoming?.serviceID),

        // required by vtpass
        country_code: mustString(incoming?.country_code).toUpperCase(),
        country: mustString(incoming?.country),

        operator_id: mustString(incoming?.operator_id),
        operator: mustString(incoming?.operator),

        product_type_id: mustString(incoming?.product_type_id),
        variation_code: mustString(incoming?.variation_code),

        billersCode: digits(incoming?.billersCode),
        phone: digits(incoming?.phone),

        contact: mustString(incoming?.contact),
        amount: Number(incoming?.amount ?? 0),

        email: mustString(incoming?.email || body?.email),
      }

        : incoming ?? {};

    // ✅ Validations
    if (billType === "data") {
  if (!normalizedPayload.phone) {
    return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
  }
  if (!normalizedPayload.network) {
    return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
  }
  if (!normalizedPayload.serviceID) {
    return NextResponse.json(
      { error: `Unsupported network: ${normalizedPayload.network}` },
      { status: 400 }
    );
  }
  if (!normalizedPayload.plan_code) {
    return NextResponse.json(
      { error: "Missing payload.plan_code (variation_code)" },
      { status: 400 }
    );
  }

  // ✅ keep plan_name required (so receipts always have it)
  if (!normalizedPayload.plan_name) {
    return NextResponse.json(
      { error: "Missing payload.plan_name (store for receipts)" },
      { status: 400 }
    );
  }

  // ✅ validity should NOT block payment
  // normalizedPayload.validity already defaults to "—"
}


    if (billType === "airtime") {
      if (!normalizedPayload.phone) {
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
      }
      if (!normalizedPayload.network) {
        return NextResponse.json({ error: "Missing payload.network" }, { status: 400 });
      }
      if (!normalizedPayload.amount || Number(normalizedPayload.amount) <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }
    }

        if (billType === "cable") {
      if (!normalizedPayload.provider) {
        return NextResponse.json({ error: "Missing payload.provider" }, { status: 400 });
      }

      if (!normalizedPayload.smartcardNumber || normalizedPayload.smartcardNumber.length < 6) {
        return NextResponse.json({ error: "Invalid payload.smartcardNumber" }, { status: 400 });
      }

      if (!normalizedPayload.bouquet) {
        return NextResponse.json({ error: "Missing payload.bouquet (variation_code)" }, { status: 400 });
      }

      if (!normalizedPayload.phone || normalizedPayload.phone.length < 10) {
        return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
      }

      if (!normalizedPayload.amount || Number(normalizedPayload.amount) <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }

      if (!normalizedPayload.totalAmount || Number(normalizedPayload.totalAmount) <= 0) {
        return NextResponse.json({ error: "Invalid payload.totalAmount" }, { status: 400 });
      }
      if (!normalizedPayload.customerName) {
        return NextResponse.json(
          { error: "Missing payload.customerName (save from verification for receipt)" },
          { status: 400 }
        );
      }
    }

    if (billType === "electricity") {
        if (!normalizedPayload.serviceID) 
          return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
        if (!normalizedPayload.meterType) 
          return NextResponse.json({ error: "Missing payload.meterType" }, { status: 400 });
        if (!normalizedPayload.meterNumber) 
          return NextResponse.json({ error: "Missing payload.meterNumber" }, { status: 400 });
        if (!normalizedPayload.phone) 
          return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });
        if (!normalizedPayload.amount || Number(normalizedPayload.amount) <= 0) {
          return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
        }    
      }
      if (billType === "education") {
      if (!normalizedPayload.serviceID)
        return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });

      if (!normalizedPayload.variation_code)
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });

      if (!normalizedPayload.phone)
        return NextResponse.json({ error: "Missing payload.phone" }, { status: 400 });

      // Amount can be fixed by variation, but still enforce > 0 for your own charging logic
      if (!normalizedPayload.amount || Number(normalizedPayload.amount) <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }
    }
      if (billType === "showmax") {
      if (!normalizedPayload.variation_code) {
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      }
      if (!normalizedPayload.billersCode || String(normalizedPayload.billersCode).length < 10) {
        return NextResponse.json({ error: "Missing/invalid payload.billersCode" }, { status: 400 });
      }
      if (!normalizedPayload.amount || Number(normalizedPayload.amount) <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }
    }
   // ✅ initiate(route.ts) - intl_airtime validation (FULL)

    if (billType === "intl_airtime") {
      const p = normalizedPayload || {};

      // ✅ serviceID must be present and allowe
      if (!p.serviceID) {
        return NextResponse.json({ error: "Missing payload.serviceID" }, { status: 400 });
      }

      if (!allowed.has(String(p.serviceID).trim())) {
        return NextResponse.json(
          { error: `Invalid payload.serviceID: "${p.serviceID}"` },
          { status: 400 }
        );
      }

      if (!p.email) {
        return NextResponse.json({ error: "Missing payload.email" }, { status: 400 });
      }

      if (!p.country_code) {
        return NextResponse.json({ error: "Missing payload.country_code" }, { status: 400 });
      }
      if (!p.country) {
        return NextResponse.json({ error: "Missing payload.country (name)" }, { status: 400 });
      }

      if (!p.product_type_id) {
        return NextResponse.json({ error: "Missing payload.product_type_id" }, { status: 400 });
      }

      if (!p.operator_id) {
        return NextResponse.json({ error: "Missing payload.operator_id" }, { status: 400 });
      }
      if (!p.operator) {
        return NextResponse.json({ error: "Missing payload.operator (name)" }, { status: 400 });
      }

      if (!p.variation_code) {
        return NextResponse.json({ error: "Missing payload.variation_code" }, { status: 400 });
      }

      const bc = digits(p.billersCode);
      if (!bc || bc.length < 10 || bc.length > 15) {
        return NextResponse.json({ error: "Missing/invalid payload.billersCode" }, { status: 400 });
      }

      const ph = digits(p.phone);
      if (!ph || ph.length < 10 || ph.length > 15) {
        return NextResponse.json({ error: "Missing/invalid payload.phone" }, { status: 400 });
      }

      const vendAmount = Number(p.amount);
      if (!Number.isFinite(vendAmount) || vendAmount <= 0) {
        return NextResponse.json({ error: "Invalid payload.amount" }, { status: 400 });
      }

      const payAmount = Number(body?.amount);
      if (!Number.isFinite(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: "Invalid request.amount" }, { status: 400 });
      }

      if (payAmount < vendAmount) {
        return NextResponse.json(
          { error: "request.amount cannot be less than payload.amount" },
          { status: 400 }
        );
      }
    }

    // 1) store pending payment
    const { error: insErr } = await supabaseAdmin.from("payments").insert({
      user_id: authedUserId,
      bill_type: billType,
      gateway,
      amount: Number(amount),
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

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/payment/callback?gateway=${gateway}&reference=${reference}`;

    // 2) initialize on selected gateway
    if (gateway === "paystack") {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(amount) * 100),
          reference,
          callback_url: callbackUrl,
          metadata: { billType, ...(meta ?? {}), payload: normalizedPayload },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Paystack init failed:", out);
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

    if (gateway === "flutterwave") {
      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: Number(amount),
          currency: "NGN",
          redirect_url: callbackUrl,
          customer: { email },
          meta: { billType, ...(meta ?? {}), payload: normalizedPayload },
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

    if (gateway === "korapay") {
      const base = process.env.KORAPAY_BASE_URL || "https://api.korapay.com";
      const endpoint =
        process.env.KORAPAY_INIT_ENDPOINT || "/merchant/api/v1/charges/initialize";

      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: "NGN",
          reference,
          redirect_url: callbackUrl,
          customer: { email },
          metadata: { billType, ...(meta ?? {}), payload: normalizedPayload },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: (out as any)?.message || "Korapay init failed", raw: out },
          { status: 400 }
        );
      }

      const checkoutUrl =
        (out as any)?.data?.checkout_url ||
        (out as any)?.data?.checkoutUrl ||
        (out as any)?.data?.link;

      if (!checkoutUrl) {
        return NextResponse.json(
          { error: "Korapay did not return checkout url", raw: out },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { type: "redirect", redirectUrl: checkoutUrl, reference },
        { status: 200 }
      );
    }

    if (gateway === "interswitch") {
      const env = process.env.INTERSWITCH_ENV || "TEST";

      const actionUrl =
        env === "LIVE"
          ? "https://newwebpay.interswitchng.com/collections/w/pay"
          : "https://newwebpay.qa.interswitchng.com/collections/w/pay";

      const merchantCode = process.env.INTERSWITCH_MERCHANT_CODE!;
      const payItemId = process.env.INTERSWITCH_PAY_ITEM_ID!;
      const amountKobo = Math.round(Number(amount) * 100);

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
            cust_email: email,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
