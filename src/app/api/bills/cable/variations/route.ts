import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

const ALLOWED = new Set(["dstv", "gotv", "startimes"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = String(searchParams.get("provider") || "").toLowerCase();

    if (!ALLOWED.has(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Use dstv, gotv, or startimes." },
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

    const url = `${vtpassBaseUrl()}/service-variations?serviceID=${provider}`;

    const res = await fetch(url, {
      headers: {
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      cache: "no-store",
    });

    const out = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: out?.message || out?.response_description || "Failed to fetch bouquets", raw: out },
        { status: 400 }
      );
    }

    // VTPass returns variations under content.variations (sometimes misspelled varations)
    const variations =
      out?.content?.variations ||
      out?.content?.varations ||
      out?.content?.Variation ||
      [];

    return NextResponse.json(
      {
        ok: true,
        provider,
        variations: Array.isArray(variations) ? variations : [],
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
