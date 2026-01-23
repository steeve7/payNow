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
    const code = String(searchParams.get("code") || "").trim();
    const product_type_id = String(searchParams.get("product_type_id") || "").trim();
    if (!code || !product_type_id) {
      return NextResponse.json({ error: "Missing code or product_type_id" }, { status: 400 });
    }

    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
        { status: 500 }
      );
    }

    const url = `${vtpassBaseUrl()}/get-international-airtime-operators?code=${encodeURIComponent(
      code
    )}&product_type_id=${encodeURIComponent(product_type_id)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "api-key": apiKey, "secret-key": secretKey },
      cache: "no-store",
    });

    const out = await res.json().catch(() => ({} as any));
    const list = Array.isArray(out?.content) ? out.content : [];

    const operators = list
      .map((o: any) => ({
        id: String(o?.operator_id ?? "").trim(),
        name: String(o?.name || "").trim(),
        image: String(o?.operator_image || "").trim(),
      }))
      .filter((o: any) => o.id && o.name);

    return NextResponse.json(
      { code, product_type_id, operators, raw: out },
      { status: res.ok ? 200 : 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
