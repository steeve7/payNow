// app/api/cable/verify/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// VTPass uses serviceID like: dstv, gotv, startimes
function mapCableServiceID(provider: string) {
  const p = String(provider || "").toLowerCase();
  if (p === "dstv") return "dstv";
  if (p === "gotv") return "gotv";
  if (p === "startimes") return "startimes";
  return null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const provider = body?.provider;
    const smartcardNumber = body?.smartcardNumber;

    if (!provider || !smartcardNumber) {
      return NextResponse.json(
        { error: "Missing provider or smartcardNumber" },
        { status: 400 }
      );
    }

    const serviceID = mapCableServiceID(provider);
    if (!serviceID) {
      return NextResponse.json(
        { error: "Invalid provider. Use dstv, gotv, or startimes" },
        { status: 400 }
      );
    }

    // VTPass verify endpoint
    const url = `${vtpassBaseUrl()}/merchant-verify`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      body: JSON.stringify({
        serviceID,
        billersCode: String(smartcardNumber).trim(),
      }),
    });

    const rawText = await res.text();
    let out: any = null;

    try {
      out = JSON.parse(rawText);
    } catch {
      out = { raw: rawText };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: out?.response_description || out?.message || "VTPass verify failed", raw: out },
        { status: 400 }
      );
    }

    // Most VTPass verify responses include customer name in content
    const customerName =
      out?.content?.Customer_Name ||
      out?.content?.customer_name ||
      out?.content?.name ||
      null;

    return NextResponse.json(
      {
        ok: true,
        provider: serviceID,
        smartcardNumber,
        customerName,
        raw: out,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
