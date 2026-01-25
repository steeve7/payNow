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
        { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env" },
        { status: 500 }
      );
    }

    // Real VTPass provider list for electricity category
    // Docs: /services?identifier=electricity-bill :contentReference[oaicite:2]{index=2}
    const url = `${vtpassBaseUrl()}/services?identifier=electricity-bill`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
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
            out?.response_description ||
            out?.message ||
            "Failed to load electricity providers from VTPass",
          raw: out,
        },
        { status: 400 }
      );
    }

    const content = Array.isArray(out?.content) ? out.content : [];
    // VTPass returns items like { serviceID, name, ... } :contentReference[oaicite:3]{index=3}
    const providers = content
      .map((x: any) => {
        const serviceID = String(x?.serviceID || "").trim();
        const name = String(x?.name || "").trim();
        if (!serviceID || !name) return null;

        return {
          id: serviceID,       // use serviceID as id (important!)
          label: name,
          serviceID: serviceID,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ providers }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
