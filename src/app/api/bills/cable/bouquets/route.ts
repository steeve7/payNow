import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "sandbox").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || "").toLowerCase();

    // VTPass serviceID values for cable TV
    const allowed = new Set(["dstv", "gotv", "startimes"]);
    if (!allowed.has(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Use dstv | gotv | startimes" },
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

    const endpoint = `${vtpassBaseUrl()}/service-variations?serviceID=${provider}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "api-key": apiKey,
        "secret-key": secretKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const rawText = await res.text();
    let out: any = null;
    try {
      out = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid response from VTPass", raw: rawText },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: out?.response_description || out?.message || "VTPass error", raw: out },
        { status: 400 }
      );
    }

    const variations = out?.content?.variations || [];
    const bouquets = variations.map((v: any) => ({
      id: String(v?.variation_code || ""),
      label: String(v?.name || ""),
      price: Number(v?.variation_amount || 0),
      fixedPrice: String(v?.fixedPrice || ""),
    }));

    return NextResponse.json(
      { provider, bouquets },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
