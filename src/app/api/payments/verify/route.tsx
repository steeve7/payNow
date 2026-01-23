// app/api/payments/verify/route.ts
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

const allowed = new Set(["foreign-airtime", "foreign-data", "foreign-pin"]);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Gateway = "paystack" | "flutterwave" | "korapay" | "interswitch";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const gateway = String(body?.gateway || "").toLowerCase() as Gateway;
    const reference = String(body?.reference || "").trim();

    if (!gateway || !reference) {
      return NextResponse.json(
        { error: "Missing gateway or reference" },
        { status: 400 }
      );
    }

    if (
      !["paystack", "flutterwave", "korapay", "interswitch"].includes(gateway)
    ) {
      return NextResponse.json(
        { error: `Unsupported gateway: ${gateway}` },
        { status: 400 }
      );
    }

    // 1) Load payment row
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .single();

    if (payErr || !payment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    let paid = false;
    let verifyRaw: any = null;

    // 2) Verify with gateway
    if (gateway === "paystack") {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );
      verifyRaw = await res.json().catch(() => ({}));
      paid = verifyRaw?.data?.status === "success";
    }

    if (gateway === "flutterwave") {
      const res = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );
      verifyRaw = await res.json().catch(() => ({}));
      paid =
        verifyRaw?.status === "success" &&
        verifyRaw?.data?.status === "successful";
    }

    if (gateway === "korapay") {
      const baseUrl = process.env.KORAPAY_BASE_URL || "https://api.korapay.com";
      const secretKey = process.env.KORAPAY_SECRET_KEY;
      if (!secretKey) {
        return NextResponse.json(
          { error: "Missing KORAPAY_SECRET_KEY in .env" },
          { status: 500 }
        );
      }

      const res = await fetch(
        `${baseUrl}/merchant/api/v1/transactions/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      verifyRaw = await res.json().catch(() => ({}));
      paid =
        verifyRaw?.status === "success" &&
        ["success", "successful", "completed"].includes(
          String(verifyRaw?.data?.status || "").toLowerCase()
        );
    }

    if (gateway === "interswitch") {
      const env = process.env.INTERSWITCH_ENV || "TEST";
      const merchantCode = process.env.INTERSWITCH_MERCHANT_CODE;
      const payItemId = process.env.INTERSWITCH_PAY_ITEM_ID;

      if (!merchantCode || !payItemId) {
        return NextResponse.json(
          {
            error:
              "Missing INTERSWITCH_MERCHANT_CODE or INTERSWITCH_PAY_ITEM_ID in .env",
          },
          { status: 500 }
        );
      }

      const base =
        env === "LIVE"
          ? "https://webpay.interswitchng.com"
          : "https://sandbox.interswitchng.com";

      const res = await fetch(
        `${base}/webpay/api/v1/transactions/${reference}?merchantCode=${merchantCode}&payItemId=${payItemId}`
      );
      verifyRaw = await res.json().catch(() => ({}));

      // Some responses use responseCode directly, others nested
      const code =
        verifyRaw?.responseCode || verifyRaw?.data?.responseCode || null;

      paid = code === "00";
    }

    // 3) Update payment status + keep gateway verify response (debug)
    const newStatus = paid ? "success" : "failed";

    await supabaseAdmin
      .from("payments")
      .update({
        status: newStatus,
        gateway_verify_response: verifyRaw, // ✅ add this JSONB column if you want (optional)
      })
      .eq("reference", reference);

    if (!paid) {
      return NextResponse.json(
        { error: "Payment not successful", raw: verifyRaw },
        { status: 400 }
      );
    }

    // 4) If already vended, don't vend again
    if (payment.vend_status === "success") {
      return NextResponse.json(
        { ok: true, status: "success", vend: "already_done" },
        { status: 200 }
      );
    }

    // helper: bump attempts
    const bumpAttempts = async () => {
      await supabaseAdmin
        .from("payments")
        .update({ vend_attempts: (payment.vend_attempts ?? 0) + 1 })
        .eq("reference", reference);
    };

    // helper: mark vend failed (but keep payment success)
const markVendFailed = async (msg: string, payload: any, vendorResult?: any) => {
  await supabaseAdmin
    .from("payments")
    .update({
      vend_status: "failed",
      vend_last_error: msg,
      // ✅ store everything: your payload + vendor result (debug/raw)
      vend_response: {
        error: msg,
        payload,
        vendor: vendorResult ?? null,
      },
    })
    .eq("reference", reference);

  return NextResponse.json(
    { ok: true, status: "success", vend: "failed", vend_error: msg },
    { status: 200 }
  );
};

    // helper: mark vend success
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

      return NextResponse.json(
        { ok: true, status: "success", vend: "success" },
        { status: 200 }
      );
    };

    // 5) DATA
    if (payment.bill_type === "data") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (!p.phone || !p.network || !p.serviceID || !p.plan_code || !p.amount) {
        return await markVendFailed(
          "Missing payload fields for data vending",
          p
        );
      }

      try {
        const result = await vendData(p);
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Data vend failed", p);
      }
    }

    // 6) AIRTIME
    if (payment.bill_type === "airtime") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (!p.phone || !p.network || !p.amount) {
        return await markVendFailed(
          "Missing payload fields for airtime vending",
          p
        );
      }

      try {
        const result = await vendAirtime({
          billType: "airtime",
          phone: p.phone,
          network: p.network,
          amount: Number(p.amount),
        });
        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Airtime vend failed", p);
      }
    }

    // 7) CABLE ✅ REAL VENDING
    if (payment.bill_type === "cable") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (!p.provider || !p.smartcardNumber || !p.bouquet || !p.phone) {
        return await markVendFailed(
          "Missing payload fields for cable vending",
          p
        );
      }

      try {
        const result = await vendCable({
          provider: p.provider,
          smartcardNumber: p.smartcardNumber,
          bouquet: p.bouquet,
          phone: p.phone,
          amount: typeof p.amount === "number" ? p.amount : undefined,
        });

        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Cable vend failed", p);
      }
    }
    // 8) ELECTRICITY ✅ REAL VENDING
    if (payment.bill_type === "electricity") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (
        !p.serviceID ||
        !p.meterType ||
        !p.meterNumber ||
        !p.phone ||
        !p.amount
      ) {
        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "failed",
            vend_last_error: "Missing payload fields for electricity vending",
            vend_response: { error: "Missing payload fields", payload: p },
          })
          .eq("reference", reference);

        return NextResponse.json(
          {
            ok: true,
            status: "success",
            vend: "failed",
            vend_error: "Missing payload fields",
          },
          { status: 200 }
        );
      }

      try {
        const result = await vendElectricity({
          billType: "electricity",
          serviceID: p.serviceID,
          meterType: p.meterType,
          meterNumber: p.meterNumber,
          phone: p.phone,
          amount: Number(p.amount),
        });

        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "success",
            vend_provider: result.provider,
            vend_reference: result.reference || null, // ✅ store reference
            vend_response: result, // ✅ includes tokenDetails under result.raw.tokenDetails
            vended_at: new Date().toISOString(),
          })
          .eq("reference", reference);

        return NextResponse.json(
          { ok: true, status: "success", vend: "success" },
          { status: 200 }
        );
      } catch (e: any) {
        const msg = e?.message || "Electricity vend failed";

        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "failed",
            vend_last_error: msg,
            vend_response: { error: msg },
          })
          .eq("reference", reference);

        return NextResponse.json(
          { ok: true, status: "success", vend: "failed", vend_error: msg },
          { status: 200 }
        );
      }
    }
    // 9) EDUCATION ✅ REAL VENDING
    if (payment.bill_type === "education") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (!p.serviceID || !p.variation_code || !p.phone || !p.amount) {
        return await markVendFailed(
          "Missing payload fields for education vending",
          p
        );
      }

      try {
        const result = await vendEducation({
          billType: "education",
          serviceID: p.serviceID,
          variation_code: p.variation_code,
          phone: p.phone,
          amount: Number(p.amount),
          quantity: p.quantity ? Number(p.quantity) : 1,
          contact: p.contact || undefined,
        });

        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Education vend failed", p);
      }
    }
    // 10) SHOWMAX ✅ REAL VENDING
    if (payment.bill_type === "showmax") {
      await bumpAttempts();
      const p = payment.payload || {};

      if (!p.serviceID || !p.variation_code || !p.billersCode || !p.amount) {
        return await markVendFailed(
          "Missing payload fields for showmax vending",
          p
        );
      }

      try {
        const result = await vendShowmax({
          billType: "showmax",
          serviceID: "showmax",
          variation_code: p.variation_code,
          billersCode: p.billersCode,
          amount: typeof p.amount === "number" ? p.amount : Number(p.amount),
          contact: p.contact || undefined,
        });

        return await markVendSuccess(result.provider, result);
      } catch (e: any) {
        return await markVendFailed(e?.message || "Showmax vend failed", p);
      }
    }

 // inside POST handler after you load `payment` from DB...

    if (payment.bill_type === "intl_airtime") {
      if (payment.vend_status === "success") {
        return NextResponse.json({ ok: true, status: "success", vend: "already_done" }, { status: 200 });
      }

      await bumpAttempts();

      const p = payment.payload || {};
      const email = String(p.email || payment.email || "").trim();

      const serviceID = String(p.serviceID || "").trim();
      const country_code = String(p.country_code || "").trim().toUpperCase();
      const country = String(p.country || "").trim();

      const operator_id = String(p.operator_id || "").trim();
      const operator = String(p.operator || "").trim();

      const missingFields: string[] = [];
      if (!email) missingFields.push("email");
      if (!serviceID) missingFields.push("serviceID");
      if (serviceID && !allowed.has(serviceID)) missingFields.push("serviceID_invalid");

      if (!country_code) missingFields.push("country_code");
      if (!country) missingFields.push("country");

      if (!operator_id) missingFields.push("operator_id");
      if (!operator) missingFields.push("operator");

      if (!p.product_type_id) missingFields.push("product_type_id");
      if (!p.variation_code) missingFields.push("variation_code");
      if (!p.phone) missingFields.push("phone");
      if (!p.billersCode) missingFields.push("billersCode");
      if (!p.amount || Number(p.amount) <= 0) missingFields.push("amount");

      if (missingFields.length > 0) {
        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "failed",
            vend_last_error: "Missing required payload fields for intl_airtime",
            vend_response: {
              error: "Missing required payload fields for intl_airtime",
              missingFields,
              payload: p,
            },
          })
          .eq("reference", payment.reference);

        return NextResponse.json(
          {
            ok: true,
            status: "success",
            vend: "failed",
            vend_error: `Missing fields: ${missingFields.join(", ")}`,
          },
          { status: 200 }
        );
      }

      if (!allowed.has(serviceID)) {
        // don’t attempt vend
        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "failed",
            vend_last_error: `Invalid serviceID: ${serviceID}`,
            vend_response: { error: `Invalid serviceID: ${serviceID}`, payload: p },
          })
          .eq("reference", payment.reference);

        return NextResponse.json(
          { ok: true, status: "success", vend: "failed", vend_error: `Invalid serviceID: ${serviceID}` },
          { status: 200 }
        );
      }

      let result: any = null;

      try {
        // ✅ IMPORTANT: vend function must accept dynamic serviceID
        result = await vendIntAirtime({
          billType: "intl_airtime",
          serviceID, // ✅ dynamic

          email,
          phone: String(p.phone),
          billersCode: String(p.billersCode),
          amount: Number(p.amount),

          country_code,
          country,

          operator_id,
          operator,

          product_type_id: String(p.product_type_id),
          variation_code: String(p.variation_code),

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

        await supabaseAdmin
          .from("payments")
          .update({
            vend_status: "success",
            vend_provider: result.provider,
            vend_reference: result.reference || null,
            vend_response: result,
            vended_at: new Date().toISOString(),
          })
          .eq("reference", payment.reference);

        return NextResponse.json({ ok: true, status: "success", vend: "success" }, { status: 200 });
      } catch (e: any) {
        const msg = e?.message || "Intl vend failed";
        return await markVendFailed(msg, p, result);
      }
    }


    // Other bill types: just return success
    return NextResponse.json({ ok: true, status: "success" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
