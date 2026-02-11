// app/api/bills/international/packages/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

function pickVariations(out: any) {
  // VTPass sometimes changes shape/spelling
  return (
    out?.content?.variations ??
    out?.content?.varations ?? // typo seen before
    out?.variations ??
    []
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // we accept this (for your UI/debug), but we DON'T use it for fetching variations
    const requestedServiceID = String(searchParams.get("serviceID") || "").trim() as IntlServiceID;

    const operator_id = String(searchParams.get("operator_id") || "").trim();
    const product_type_id = String(searchParams.get("product_type_id") || "").trim();

    if (!operator_id) {
      return NextResponse.json({ error: "Missing operator_id" }, { status: 400 });
    }
    if (!product_type_id) {
      return NextResponse.json({ error: "Missing product_type_id" }, { status: 400 });
    }

    /**
     * ✅ IMPORTANT (based on your working route):
     * VTPass intl variations come from serviceID=foreign-airtime
     * even when the UI flow is foreign-data / foreign-pin.
     */
    const variationsServiceID: IntlServiceID = "foreign-airtime";

    const url =
      `${vtpassBaseUrl()}/service-variations` +
      `?serviceID=${encodeURIComponent(variationsServiceID)}` +
      `&operator_id=${encodeURIComponent(operator_id)}` +
      `&product_type_id=${encodeURIComponent(product_type_id)}`;

    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
        { status: 500 }
      );
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      cache: "no-store",
    });

    const out = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            out?.content?.errors?.[0] ||
            out?.response_description ||
            out?.message ||
            "Failed to load packages",
          raw: out,
          debug: {
            url,
            operator_id,
            product_type_id,
            requestedServiceID,
            variationsServiceID,
            status: res.status,
          },
        },
        { status: res.status }
      );
    }

    const variations = pickVariations(out);
    const arr = Array.isArray(variations) ? variations : [];

    const packages = arr
      .map((v: any) => ({
        variation_code: String(v?.variation_code || "").trim(),
        name: String(v?.name || "").trim(),
        fixedPrice: v?.fixedPrice ?? null,
        variation_amount: v?.variation_amount ?? null,
        charged_amount: v?.charged_amount ?? null,
        variation_rate: v?.variation_rate ?? null,
      }))
      .filter((p: any) => p.variation_code && p.name);

    return NextResponse.json({
      ok: true,

      // what UI asked for (foreign-data / foreign-pin / foreign-airtime)
      requestedServiceID: requestedServiceID || null,

      // what we MUST use to actually get variations from VTPass
      variationsServiceID,

      operator_id,
      product_type_id,
      count: packages.length,
      packages,

      // keep raw during debugging; remove later
      raw: out,
      debug: { url },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error loading packages" },
      { status: 500 }
    );
  }
}
