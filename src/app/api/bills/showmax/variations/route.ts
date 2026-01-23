// src/app/api/bills/showmax/variations/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

function normalizePackages(variations: any[]) {
  return variations
    .map((v: any) => ({
      variation_code: String(v?.variation_code || v?.code || "").trim(),
      name: String(v?.name || v?.title || "").trim(),
      variation_amount: v?.variation_amount ?? v?.amount,
      fixedPrice: v?.fixedPrice ?? v?.fixed_price,
    }))
    .filter((x: any) => x.variation_code);
}

export async function GET() {
  try {
    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env" },
        { status: 500 }
      );
    }

    // VTPass Showmax variations: /service-variations?serviceID=showmax
    const url = `${vtpassBaseUrl()}/service-variations?serviceID=showmax`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "api-key": apiKey, "secret-key": secretKey },
      cache: "no-store",
    });

    const out = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return NextResponse.json(
        { error: out?.message || out?.response_description || "Failed to load plans", raw: out },
        { status: 400 }
      );
    }

    const variations = Array.isArray(out?.content?.variations)
      ? out.content.variations
      : Array.isArray(out?.content?.varations) // vtpass misspelling sometimes
      ? out.content.varations
      : [];

    const packages = normalizePackages(variations);

    return NextResponse.json(
      { serviceID: "showmax", packages, raw: out },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
