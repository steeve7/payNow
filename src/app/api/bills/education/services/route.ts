import { NextResponse } from "next/server";

export const runtime = "nodejs";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

export async function GET() {
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
      `${vtpassBaseUrl()}/services?identifier=education`,
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

    if (!res.ok) {
      throw new Error(out?.message || "Failed to load education services");
    }

    // 🔑 VTPass only supports WAEC education
    const services = Array.isArray(out?.content)
      ? out.content
          .filter((s: any) => s?.serviceID === "waec")
          .map((s: any) => ({
            id: "waec",
            title: "WAEC Result Checker PIN",
            serviceID: "waec",
            providers: ["vtpass"],
          }))
      : [];

    return NextResponse.json({ services }, { status: 200 });
  } catch (e: any) {
    // Even if VTpass fails, return empty list (never crash UI)
    return NextResponse.json({ services: [] }, { status: 200 });
  }
}
