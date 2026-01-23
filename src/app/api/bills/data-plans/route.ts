import { NextResponse } from "next/server";

const NETWORK_TO_VTPASS_SERVICE_ID: Record<string, string> = {
  mtn: "mtn-data",
  airtel: "airtel-data",
  glo: "glo-data",
  "9mobile": "9mobile-data",
};

type Plan = {
  id: string;        // variation_code
  name: string;      // plan name
  amount: number;    // naira
  fixedPrice?: boolean;
  serviceID: string; // mtn-data, airtel-data...
  validity: string;  // parsed from name
};

function extractValidityFromPlanName(name: string): string {
  const n = String(name || "").trim();
  if (!n) return "—";

  // Common patterns: "7 Days", "30days", "1 Month", "24 Hrs", "1Day", "2 Weeks"
  const m = n.match(
    /(\d+)\s*(day|days|d|hour|hours|hr|hrs|week|weeks|wk|wks|month|months|mo|mos)\b/i
  );
  if (!m) return "—";

  const num = m[1];
  const unit = m[2].toLowerCase();

  if (unit === "d" || unit.startsWith("day")) return `${num} Day${num === "1" ? "" : "s"}`;
  if (unit.startsWith("h") || unit.includes("hour") || unit.includes("hr"))
    return `${num} Hour${num === "1" ? "" : "s"}`;
  if (unit.startsWith("w") || unit.includes("week"))
    return `${num} Week${num === "1" ? "" : "s"}`;
  if (unit.startsWith("m") || unit.includes("month") || unit.includes("mo"))
    return `${num} Month${num === "1" ? "" : "s"}`;

  return "—";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const network = (searchParams.get("network") || "").toLowerCase().trim();

    if (!network) {
      return NextResponse.json({ error: "Missing network" }, { status: 400 });
    }

    const serviceID = NETWORK_TO_VTPASS_SERVICE_ID[network];
    if (!serviceID) {
      return NextResponse.json(
        { error: `Unsupported network: ${network}` },
        { status: 400 }
      );
    }

    const env = (process.env.VTPASS_ENV || "sandbox").toLowerCase();
    const baseUrl =
      env === "production" ? "https://vtpass.com" : "https://sandbox.vtpass.com";

    const apiKey = process.env.VTPASS_API_KEY || "";
    const publicKey = process.env.VTPASS_PUBLIC_KEY || "";

    if (!apiKey || !publicKey) {
      return NextResponse.json(
        { error: "Missing VTPASS_API_KEY or VTPASS_PUBLIC_KEY in .env" },
        { status: 500 }
      );
    }

    const res = await fetch(
      `${baseUrl}/api/service-variations?serviceID=${encodeURIComponent(serviceID)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          "public-key": publicKey,
        },
        cache: "no-store",
      }
    );

    const rawText = await res.text();

    let out: any;
    try {
      out = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "VTPass returned non-JSON response", raw: rawText },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: out?.response_description || out?.message || "VTPass error",
          raw: out,
        },
        { status: 502 }
      );
    }

    const variations: any[] = out?.content?.variations || [];

    // Normalize (typed) + add validity
    const rawPlans: Plan[] = variations.map((v: any) => {
      const name = String(v?.name || "").trim();
      return {
        id: String(v?.variation_code || "").trim(),
        name,
        amount: Number(v?.variation_amount || 0),
        fixedPrice: Boolean(v?.fixedPrice),
        serviceID,
        validity: extractValidityFromPlanName(name), // ✅ NEW
      };
    });

    // Deduplicate by id (variation_code)
    const seen = new Set<string>();
    const plans: Plan[] = rawPlans.filter((p: Plan) => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return NextResponse.json(
      { ok: true, network, serviceID, plans },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
