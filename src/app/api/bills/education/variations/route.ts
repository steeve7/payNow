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
      variation_code: String(v?.variation_code || "").trim(),
      name: String(v?.name || "").trim(),
      variation_amount: v?.variation_amount,
      fixedPrice: v?.fixedPrice,
    }))
    .filter((x) => x.variation_code);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceID = String(searchParams.get("serviceID") || "").trim();

  if (!serviceID) {
    return NextResponse.json({ error: "Missing serviceID" }, { status: 400 });
  }

  // ❌ Only WAEC exists right now
  if (serviceID !== "waec") {
    return NextResponse.json(
      { provider: "none", serviceID, packages: [] },
      { status: 200 }
    );
  }

  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: "Missing VTPASS credentials" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `${vtpassBaseUrl()}/service-variations?serviceID=waec`,
      {
        method: "GET",
        headers: {
          "api-key": apiKey,
          "secret-key": secretKey,
        },
        cache: "no-store",
      }
    );

    const out = await res.json().catch(() => ({}));

    const variations =
      out?.content?.variations || out?.content?.varations || [];

    return NextResponse.json(
      {
        provider: "vtpass",
        serviceID,
        packages: normalizePackages(variations),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { provider: "vtpass", serviceID, packages: [] },
      { status: 200 }
    );
  }
}
