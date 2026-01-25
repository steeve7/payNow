// app/api/bills/international/packages/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const operator_id = String(searchParams.get("operator_id") || "").trim();
    const product_type_id = String(searchParams.get("product_type_id") || "").trim();

    if (!operator_id) {
      return NextResponse.json({ error: "Missing operator_id" }, { status: 400 });
    }
    if (!product_type_id) {
      return NextResponse.json({ error: "Missing product_type_id" }, { status: 400 });
    }

    // IMPORTANT: VTPass intl flow uses foreign-airtime for variations + purchase
    const serviceID = "foreign-airtime";

    const url = `${vtpassBaseUrl()}/service-variations?serviceID=${serviceID}&operator_id=${encodeURIComponent(
      operator_id
    )}&product_type_id=${encodeURIComponent(product_type_id)}`;

    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "api-key": apiKey } : {}),
        ...(secretKey ? { "secret-key": secretKey } : {}),
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
            "Failed to load packages",
          raw: out,
        },
        { status: res.status }
      );
    }

    const variations = out?.content?.variations || out?.content?.varations || [];
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
      serviceID,
      operator_id,
      product_type_id,
      packages,
      raw: out,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error loading packages" },
      { status: 500 }
    );
  }
}
