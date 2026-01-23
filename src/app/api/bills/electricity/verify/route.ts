import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

export async function POST(req: Request) {
  try {
    const { serviceID, meterType, meterNumber } = await req.json();

    if (!serviceID || !meterType || !meterNumber) {
      return NextResponse.json(
        { error: "Missing serviceID, meterType, or meterNumber" },
        { status: 400 }
      );
    }

    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env" },
        { status: 500 }
      );
    }

    // VTPass verify endpoint: /merchant-verify (used across bills)
    const res = await fetch(`${vtpassBaseUrl()}/merchant-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      body: JSON.stringify({
        serviceID: String(serviceID).trim(),
        billersCode: String(meterNumber).trim(),
        type: String(meterType).toLowerCase(), // prepaid | postpaid
      }),
    });

    const out = await res.json().catch(() => ({} as any));

    // Hard fail if HTTP not ok
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            out?.response_description ||
            out?.message ||
            "Meter verification failed",
          raw: out,
        },
        { status: 400 }
      );
    }

    // ✅ Strict success check
    const ok =
      String(out?.response_description || "").trim() === "000" ||
      String(out?.code || "").trim() === "000";

    const customerName =
      out?.content?.Customer_Name ||
      out?.content?.customer_name ||
      out?.customer_name ||
      out?.Customer_Name ||
      "";

    if (!ok || !String(customerName).trim()) {
      return NextResponse.json(
        { error: "Invalid meter number. Please check and try again.", raw: out },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: true, customerName: String(customerName).trim(), raw: out },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
