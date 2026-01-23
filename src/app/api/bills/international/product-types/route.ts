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
    const code = String(searchParams.get("code") || "").trim(); // country code
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
        { status: 500 }
      );
    }

    const url = `${vtpassBaseUrl()}/get-international-airtime-product-types?code=${encodeURIComponent(code)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "api-key": apiKey, "secret-key": secretKey },
      cache: "no-store",
    });

    const out = await res.json().catch(() => ({} as any));
    const list = Array.isArray(out?.content) ? out.content : [];

    const productTypes = list
      .map((p: any) => ({
        id: String(p?.product_type_id ?? "").trim(), // keep as string
        name: String(p?.name || "").trim(),
      }))
      .filter((p: any) => p.id && p.name);

    return NextResponse.json(
      { code, productTypes, raw: out },
      { status: res.ok ? 200 : 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
