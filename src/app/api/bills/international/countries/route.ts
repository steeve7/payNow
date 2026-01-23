import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

export async function GET() {
  try {
    const apiKey = process.env.VTPASS_API_KEY;
    const secretKey = process.env.VTPASS_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
        { status: 500 }
      );
    }

    const res = await fetch(`${vtpassBaseUrl()}/get-international-airtime-countries`, {
      method: "GET",
      headers: { "api-key": apiKey, "secret-key": secretKey },
      cache: "no-store",
    });

    const out = await res.json().catch(() => ({} as any));
    const countries = Array.isArray(out?.content?.countries) ? out.content.countries : [];

    const normalized = countries
      .map((c: any) => ({
        code: String(c?.code || "").trim(),
        name: String(c?.name || "").trim(),
        prefix: String(c?.prefix || "").trim(),
        currency: String(c?.currency || "").trim(),
        flag: String(c?.flag || "").trim(),
      }))
      .filter((c: any) => c.code && c.name);

    return NextResponse.json(
      { countries: normalized, raw: out },
      { status: res.ok ? 200 : 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
