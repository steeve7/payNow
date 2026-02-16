// src/app/api/payments/verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { vendData } from "@/lib/vendors/vendData";
import { vendAirtime } from "@/lib/vendors/vendAirtime";
import { vendCable } from "@/lib/vendors/vendCable";
import { vendElectricity } from "@/lib/vendors/vendElectricity";
import { vendEducation } from "@/lib/vendors/vendEducation";
import { vendShowmax } from "@/lib/vendors/vendShowmax";
import { vendIntAirtime } from "@/lib/vendors/vendIntAirtime";

export const runtime = "nodejs";

type Gateway = "paystack" | "flutterwave" | "seerbit";

// Intl type
type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";
function isIntlServiceID(v: string): v is IntlServiceID {
  return v === "foreign-airtime" || v === "foreign-data" || v === "foreign-pin";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIN_NGN = 100;

const num = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const digits = (v: any) => String(v ?? "").replace(/\D/g, "");

const fallbackEmailFromPhone = (phoneRaw: any) => {
  const phone = digits(phoneRaw);
  const safe = phone || "guest";
  return `guest_${safe}@paynow.ng`;
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

async function getSeerbitEncryptedKey() {
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

// Seerbit v3 paid check
function isSeerbitPaidV3(raw: any) {
  const status = String(raw?.status || "").toUpperCase().trim();
  const code = String(raw?.data?.code || "").trim();
  const msg = String(raw?.data?.message || "").toLowerCase();

  if (
    status === "SUCCESS" &&
    (code === "00" || msg.includes("successful") || msg.includes("approved"))
  ) {
    return true;
  }
  return false;
}

function isSeerbitPending(raw: any) {
  const status = String(raw?.status || "").toUpperCase().trim();
  const code = String(raw?.data?.code || raw?.code || "").toUpperCase().trim();
  const msg = String(raw?.data?.message || raw?.message || raw?.error || "").toLowerCase();

  if (status === "PENDING") return true;
  if (code === "S20") return true;
  if (msg.includes("pending") || msg.includes("processing")) return true;
  return false;
}

/** ------------------ Amount helpers ------------------ **/

// parse "14999.91" => 15000
function parseMoneyLike(v: any) {
  const x = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.round(x);
}

// parse "..., 15,000 Naira" => 15000
function parseAmountFromText(text: any) {
  const t = String(text ?? "");
  const m = t.match(/(\d[\d,]{2,})\s*naira/i) || t.match(/(\d[\d,]{2,})/);
  if (!m) return 0;
  const val = Number(String(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.round(val);
}

// Compare amounts safely (integers NGN)
function sameNgn(a: any, b: any) {
  return Math.round(num(a)) === Math.round(num(b));
}

// Extract amount from Seerbit response (best-effort across variants)
function extractSeerbitAmount(raw: any): number {
  // try common fields seen across docs/implementations
  const candidates = [
    raw?.data?.amount,
    raw?.data?.transactionAmount,
    raw?.data?.paymentAmount,
    raw?.data?.totalAmount,
    raw?.amount,
    raw?.transactionAmount,
    raw?.paymentAmount,
    raw?.totalAmount,
  ];

  for (const c of candidates) {
    const v = num(c);
    if (v > 0) return Math.round(v);
  }

  // sometimes it's a string nested deeper
  const deep = num(raw?.data?.payment?.amount || raw?.data?.payment?.totalAmount);
  if (deep > 0) return Math.round(deep);

  return 0;
}

/** ---------------------------------------------------------- **/

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const gateway = String(body?.gateway || "").toLowerCase() as Gateway;
    const reference = String(body?.reference || "").trim();

    if (!gateway || !reference) {
      return NextResponse.json({ error: "Missing gateway or reference" }, { status: 400 });
    }

    if (!["paystack", "flutterwave", "seerbit"].includes(gateway)) {
      return NextResponse.json({ error: `Unsupported gateway: ${gateway}` }, { status: 400 });
    }

    // 1) Load payment row
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .single();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Guard: server should never vend below MIN
    const dbAmount = num(payment.amount);
    if (!Number.isFinite(dbAmount) || dbAmount < MIN_NGN) {
      // don't vend, even if gateway says success
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          vend_status: payment.vend_status ?? "pending",
          vend_last_error: `Security: invalid payment amount (${dbAmount})`,
        })
        .eq("reference", reference);

      return NextResponse.json(
        { error: `Security: invalid payment amount (${dbAmount})` },
        { status: 400 }
      );
    }

    // If already successful + vended, exit early
    if (payment.status === "success" && payment.vend_status === "success") {
      return NextResponse.json({ ok: true, status: "success", vend: "already_done" }, { status: 200 });
    }

    let paid = false;
    let verifyRaw: any = null;
    let pending = false;

    // 2) Verify with gateway + AMOUNT MATCH
    if (gateway === "paystack") {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });

      verifyRaw = await res.json().catch(() => ({}));

      const statusOk = verifyRaw?.data?.status === "success";

      // Paystack returns amount in kobo
      const paidKobo = num(verifyRaw?.data?.amount);
      const expectedKobo = Math.round(dbAmount * 100);

      const amountOk = paidKobo === expectedKobo;

      paid = statusOk && amountOk;
      pending = !paid;

      if (statusOk && !amountOk) {
        // log mismatch
        await supabaseAdmin
          .from("payments")
          .update({
            status: "failed",
            gateway_verify_response: { ...verifyRaw, _security: { expectedKobo, paidKobo } },
            vend_last_error: `Security: amount mismatch (expected ₦${dbAmount}, got ₦${paidKobo / 100})`,
          })
          .eq("reference", reference);

        return NextResponse.json(
          { error: "Security: amount mismatch", raw: verifyRaw },
          { status: 400 }
        );
      }
    }

    if (gateway === "flutterwave") {
      const res = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );

      verifyRaw = await res.json().catch(() => ({}));

      const statusOk = verifyRaw?.status === "success" && verifyRaw?.data?.status === "successful";

      // Flutterwave amount is usually in NGN units
      const paidNgn = num(verifyRaw?.data?.amount);
      const amountOk = sameNgn(paidNgn, dbAmount);

      paid = statusOk && amountOk;
      pending = !paid;

      if (statusOk && !amountOk) {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "failed",
            gateway_verify_response: { ...verifyRaw, _security: { expectedNgn: dbAmount, paidNgn } },
            vend_last_error: `Security: amount mismatch (expected ₦${dbAmount}, got ₦${paidNgn})`,
          })
          .eq("reference", reference);

        return NextResponse.json(
          { error: "Security: amount mismatch", raw: verifyRaw },
          { status: 400 }
        );
      }
    }

    if (gateway === "seerbit") {
      const encryptedKey = await getSeerbitEncryptedKey();
      const url = `https://seerbitapi.com/api/v3/payments/query/${encodeURIComponent(reference)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${encryptedKey}`,
          "Content-Type": "application/json",
        },
      });

      verifyRaw = await res.json().catch(() => ({}));

      if (!res.ok) {
        pending = true;
        const isProc = isSeerbitPending(verifyRaw);

        await supabaseAdmin
          .from("payments")
          .update({
            status: isProc ? "processing" : "pending",
            gateway_verify_response: {
              ...verifyRaw,
              _debug: { ok: false, http_status: res.status, url },
            },
          })
          .eq("reference", reference);

        return NextResponse.json(
          {
            ok: false,
            status: isProc ? "processing" : "pending",
            message: isProc ? "Payment is still processing" : "Payment not confirmed yet",
            raw: verifyRaw,
          },
          { status: 202 }
        );
      }

      const statusOk = isSeerbitPaidV3(verifyRaw);
      const paidNgn = extractSeerbitAmount(verifyRaw);

      // If Seerbit doesn't send amount in this response, we can't safely vend.
      // Better to block than allow abuse.
      if (statusOk && !paidNgn) {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "failed",
            gateway_verify_response: { ...verifyRaw, _security: { expectedNgn: dbAmount, paidNgn } },
            vend_last_error: "Security: Seerbit verify missing amount field",
          })
          .eq("reference", reference);

        return NextResponse.json(
          { error: "Security: gateway verify missing amount", raw: verifyRaw },
          { status: 400 }
        );
      }

      const amountOk = paidNgn ? sameNgn(paidNgn, dbAmount) : false;

      paid = statusOk && amountOk;
      pending = !paid && isSeerbitPending(verifyRaw);

      if (statusOk && !amountOk) {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "failed",
            gateway_verify_response: { ...verifyRaw, _security: { expectedNgn: dbAmount, paidNgn } },
            vend_last_error: `Security: amount mismatch (expected ₦${dbAmount}, got ₦${paidNgn})`,
          })
          .eq("reference", reference);

        return NextResponse.json(
          { error: "Security: amount mismatch", raw: verifyRaw },
          { status: 400 }
        );
      }
    }

    // 3) Update payment status (don’t mark failed on pending)
    const newStatus =
      paid ? "success" : pending ? "processing" : (payment.status === "success" ? "success" : "pending");

    await supabaseAdmin
      .from("payments")
      .update({
        status: newStatus,
        gateway_verify_response: verifyRaw,
      })
      .eq("reference", reference);

    if (!paid) {
      return NextResponse.json(
        { error: pending ? "Payment processing" : "Payment not confirmed", raw: verifyRaw },
        { status: pending ? 202 : 400 }
      );
    }

    // 4) Idempotency
    if (payment.vend_status === "success") {
      return NextResponse.json({ ok: true, status: "success", vend: "already_done" }, { status: 200 });
    }

    // Lock row for vending (only if still pending)
    const { data: locked, error: lockErr } = await supabaseAdmin
      .from("payments")
      .update({ vend_status: "processing" })
      .eq("reference", reference)
      .eq("vend_status", "pending")
      .select("*")
      .single();

    if (lockErr || !locked) {
      return NextResponse.json(
        { ok: true, status: "success", vend: "already_processing_or_done" },
        { status: 200 }
      );
    }

    const currentPayment = locked;

    const bumpAttempts = async () => {
      await supabaseAdmin
        .from("payments")
        .update({ vend_attempts: (currentPayment.vend_attempts ?? 0) + 1 })
        .eq("reference", reference);
    };

    const markVendFailed = async (msg: string, payload: any, vendorResult?: any) => {
      await supabaseAdmin
        .from("payments")
        .update({
          vend_status: "failed",
          vend_last_error: msg,
          vend_response: { error: msg, payload, vendor: vendorResult ?? null },
        })
        .eq("reference", reference);

      return NextResponse.json(
        { ok: true, status: "success", vend: "failed", vend_error: msg },
        { status: 200 }
      );
    };

    const markVendSuccess = async (provider: string, result: any) => {
      await supabaseAdmin
        .from("payments")
        .update({
          vend_status: "success",
          vend_provider: provider,
          vend_response: result,
          vended_at: new Date().toISOString(),
        })
        .eq("reference", reference);

      return NextResponse.json({ ok: true, status: "success", vend: "success" }, { status: 200 });
    };

    //  Stronger: require vendAmount === paidAmount for ALL bill types
    const enforceEqualToPaid = async (label: string, vendAmount: number, p: any) => {
      const paidAmount = num(currentPayment.amount);
      if (vendAmount !== paidAmount) {
        return await markVendFailed(
          `${label}: amount mismatch (vend ${vendAmount} !== paid ${paidAmount})`,
          p
        );
      }
      return null;
    };

    // Data plan amount defense-in-depth
    const enforceDataPlanPrice = async (p: any) => {
      const vendAmount = num(p.amount);
      const expectedFromCk = parseMoneyLike(p.ck_plan_code);
      const expectedFromName = parseAmountFromText(p.plan_name);
      const expected = expectedFromCk > 0 ? expectedFromCk : expectedFromName;

      if (!expected) {
        return await markVendFailed("data: unable to validate plan price", p);
      }
      if (vendAmount !== expected) {
        return await markVendFailed(
          `data: plan price mismatch (expected ₦${expected}, got ₦${vendAmount})`,
          p
        );
      }
      return null;
    };

    // ----- DATA -----
    if (currentPayment.bill_type === "data") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.phone || !p.network || !p.serviceID || !p.plan_code || !p.amount) {
        return await markVendFailed("Missing payload fields for data vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("data", vendAmount, p);
      if (secEq) return secEq;

      const secPlan = await enforceDataPlanPrice(p);
      if (secPlan) return secPlan;

      try {
        const result = await vendData({
          billType: "data",
          phone: p.phone,
          network: p.network,
          serviceID: p.serviceID,
          plan_code: p.plan_code,
          ck_plan_code: p.ck_plan_code,
          plan_name: p.plan_name,
          validity: p.validity,
          amount: vendAmount,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Data vend failed", p);
      }
    }

    // ----- AIRTIME -----
    if (currentPayment.bill_type === "airtime") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.phone || !p.network || !p.amount) {
        return await markVendFailed("Missing payload fields for airtime vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("airtime", vendAmount, p);
      if (secEq) return secEq;

      try {
        const result = await vendAirtime({
          billType: "airtime",
          phone: p.phone,
          network: p.network,
          amount: vendAmount,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Airtime vend failed", p);
      }
    }

    // ----- CABLE -----
    if (currentPayment.bill_type === "cable") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.provider || !p.smartcardNumber || !p.bouquet || !p.phone || !p.amount) {
        return await markVendFailed("Missing payload fields for cable vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("cable", vendAmount, p);
      if (secEq) return secEq;

      try {
        const result = await vendCable({
          provider: p.provider,
          smartcardNumber: p.smartcardNumber,
          bouquet: p.bouquet,
          phone: p.phone,
          amount: vendAmount,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Cable vend failed", p);
      }
    }

    // ----- ELECTRICITY -----
    if (currentPayment.bill_type === "electricity") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.serviceID || !p.meterType || !p.meterNumber || !p.phone || !p.amount) {
        return await markVendFailed("Missing payload fields for electricity vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("electricity", vendAmount, p);
      if (secEq) return secEq;

      try {
        const result = await vendElectricity({
          billType: "electricity",
          serviceID: p.serviceID,
          meterType: p.meterType,
          meterNumber: p.meterNumber,
          phone: p.phone,
          amount: vendAmount,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Electricity vend failed", p);
      }
    }

    // ----- EDUCATION -----
    if (currentPayment.bill_type === "education") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.serviceID || !p.variation_code || !p.phone || !p.amount) {
        return await markVendFailed("Missing payload fields for education vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("education", vendAmount, p);
      if (secEq) return secEq;

      try {
        const result = await vendEducation({
          billType: "education",
          serviceID: p.serviceID,
          variation_code: p.variation_code,
          phone: p.phone,
          amount: vendAmount,
          quantity: p.quantity ? Number(p.quantity) : 1,
          contact: p.contact || undefined,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Education vend failed", p);
      }
    }

    // ----- SHOWMAX -----
    if (currentPayment.bill_type === "showmax") {
      await bumpAttempts();
      const p = currentPayment.payload || {};
      if (!p.variation_code || !p.billersCode || !p.amount) {
        return await markVendFailed("Missing payload fields for showmax vending", p);
      }

      const vendAmount = num(p.amount);

      const secEq = await enforceEqualToPaid("showmax", vendAmount, p);
      if (secEq) return secEq;

      try {
        const result = await vendShowmax({
          billType: "showmax",
          serviceID: "showmax",
          variation_code: p.variation_code,
          billersCode: p.billersCode,
          amount: vendAmount,
          contact: p.contact || undefined,
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Showmax vend failed", p);
      }
    }

    // ----- INTL AIRTIME -----
    if (currentPayment.bill_type === "intl_airtime") {
      await bumpAttempts();
      const p = currentPayment.payload || {};

      const rawServiceID = String(p.serviceID || "").trim();
      if (!isIntlServiceID(rawServiceID)) {
        return await markVendFailed(`Invalid serviceID: ${rawServiceID}`, p);
      }
      const serviceID: IntlServiceID = rawServiceID;

      const vendAmount = num(p.amount);
      if (!vendAmount || vendAmount <= 0) {
        return await markVendFailed("Invalid intl_airtime amount", p);
      }

      const secEq = await enforceEqualToPaid("intl_airtime", vendAmount, p);
      if (secEq) return secEq;

      const emailForIntl =
        String(p.email || "").trim() || fallbackEmailFromPhone(p.phone || p.billersCode);

      try {
        const result = await vendIntAirtime({
          billType: "intl_airtime",
          serviceID,
          email: emailForIntl,
          phone: String(p.phone),
          billersCode: String(p.billersCode),
          amount: vendAmount,
          country_code: String(p.country_code || "").trim().toUpperCase(),
          country: String(p.country || "").trim(),
          operator_id: String(p.operator_id || "").trim(),
          operator: String(p.operator || "").trim(),
          product_type_id: String(p.product_type_id || "").trim(),
          variation_code: String(p.variation_code || "").trim(),
          contact: p.contact ? String(p.contact) : "",
        });

        if (!result?.ok) {
          const msg =
            result?.raw?.content?.errors?.[0] ||
            result?.raw?.response_description ||
            result?.error ||
            "Intl vending failed";
          return await markVendFailed(msg, p, result);
        }

        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Intl vend failed", p);
      }
    }

    return NextResponse.json({ ok: true, status: "success" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
