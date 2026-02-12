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

// ✅ define the missing type here (or import it if you export it from vendIntAirtime)
type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";

function isIntlServiceID(v: string): v is IntlServiceID {
  return v === "foreign-airtime" || v === "foreign-data" || v === "foreign-pin";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

function seerbitTokenFromEnv() {
  const publicKey = String(process.env.SEERBIT_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.SEERBIT_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) {
    throw new Error("Missing SEERBIT_PUBLIC_KEY or SEERBIT_PRIVATE_KEY in env");
  }
  const token = Buffer.from(`${publicKey}:${privateKey}`).toString("base64");
  return { token, publicKey };
}

function isSeerbitPaid(raw: any) {
  const status = String(raw?.data?.status || raw?.status || raw?.data?.paymentStatus || "")
    .toLowerCase()
    .trim();

  const code = String(raw?.data?.code || raw?.code || raw?.data?.responseCode || "")
    .toLowerCase()
    .trim();

  const paidFlag =
    raw?.data?.paid === true ||
    raw?.data?.successful === true ||
    raw?.data?.success === true ||
    raw?.success === true;

  if (paidFlag) return true;
  if (["successful", "success", "approved", "completed", "paid"].includes(status)) return true;
  if (code === "00" || code === "0") return true;

  return false;
}

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

    let paid = false;
    let verifyRaw: any = null;

    // 2) Verify with gateway
    if (gateway === "paystack") {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      verifyRaw = await res.json().catch(() => ({}));
      paid = verifyRaw?.data?.status === "success";
    }

    if (gateway === "flutterwave") {
      const res = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      verifyRaw = await res.json().catch(() => ({}));
      paid = verifyRaw?.status === "success" && verifyRaw?.data?.status === "successful";
    }

    if (gateway === "seerbit") {
      const { token: seerbitToken, publicKey } = seerbitTokenFromEnv();

      const tryFetch = async (url: string) => {
        const r = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${seerbitToken}`,
            "Content-Type": "application/json",
          },
        });
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, json: j };
      };

      let out = await tryFetch(
        `https://seerbitapi.com/api/v2/transactions/query?reference=${encodeURIComponent(
          reference
        )}&publicKey=${encodeURIComponent(publicKey)}`
      );

      if (!out.ok) {
        out = await tryFetch(
          `https://seerbitapi.com/api/v2/payments/query/${encodeURIComponent(
            reference
          )}?publicKey=${encodeURIComponent(publicKey)}`
        );
      }

      verifyRaw = out.json;
      paid = isSeerbitPaid(verifyRaw);
    }

    // 3) Update payment status
    await supabaseAdmin
      .from("payments")
      .update({
        status: paid ? "success" : "failed",
        gateway_verify_response: verifyRaw,
      })
      .eq("reference", reference);

    if (!paid) {
      return NextResponse.json({ error: "Payment not successful", raw: verifyRaw }, { status: 400 });
    }

    // 4) Idempotency
    if (payment.vend_status === "success") {
      return NextResponse.json({ ok: true, status: "success", vend: "already_done" }, { status: 200 });
    }

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

    const enforceVendNotMoreThanPaid = async (label: string, vendAmount: number, p: any) => {
      const paidAmount = num(currentPayment.amount);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return await markVendFailed(`${label}: invalid paid amount (${paidAmount})`, p);
      }
      if (!Number.isFinite(vendAmount) || vendAmount <= 0) {
        return await markVendFailed(`${label}: invalid vend amount (${vendAmount})`, p);
      }
      if (vendAmount > paidAmount) {
        return await markVendFailed(
          `Security check failed (${label}): vend amount (${vendAmount}) > paid amount (${paidAmount})`,
          p
        );
      }
      return null;
    };

    const enforceEqualForAirtimeAndData = async (label: string, vendAmount: number, p: any) => {
      const paidAmount = num(currentPayment.amount);
      if (vendAmount !== paidAmount) {
        return await markVendFailed(`${label}: amount mismatch (vend ${vendAmount} !== paid ${paidAmount})`, p);
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
      const sec1 = await enforceVendNotMoreThanPaid("data", vendAmount, p);
      if (sec1) return sec1;
      const sec2 = await enforceEqualForAirtimeAndData("data", vendAmount, p);
      if (sec2) return sec2;

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
      const sec1 = await enforceVendNotMoreThanPaid("airtime", vendAmount, p);
      if (sec1) return sec1;
      const sec2 = await enforceEqualForAirtimeAndData("airtime", vendAmount, p);
      if (sec2) return sec2;

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
      if (!p.provider || !p.smartcardNumber || !p.bouquet || !p.phone) {
        return await markVendFailed("Missing payload fields for cable vending", p);
      }
      const vendAmount = num(p.amount || p.totalAmount);
      const sec = await enforceVendNotMoreThanPaid("cable", vendAmount, p);
      if (sec) return sec;

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
      const sec = await enforceVendNotMoreThanPaid("electricity", vendAmount, p);
      if (sec) return sec;

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
      const sec = await enforceVendNotMoreThanPaid("education", vendAmount, p);
      if (sec) return sec;

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
      const sec = await enforceVendNotMoreThanPaid("showmax", vendAmount, p);
      if (sec) return sec;

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

      const sec = await enforceVendNotMoreThanPaid("intl_airtime", vendAmount, p);
      if (sec) return sec;

      const emailForIntl =
        String(p.email || "").trim() || fallbackEmailFromPhone(p.phone || p.billersCode);

      try {
        const result = await vendIntAirtime({
          billType: "intl_airtime",
          serviceID, // ✅ typed
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
