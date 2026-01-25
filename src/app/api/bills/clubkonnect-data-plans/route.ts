// app/api/bills/clubkonnect-data-plans/route.ts
import { NextResponse } from "next/server";

type Plan = {
  id: string;        //  CK DataPlan ID (example: "1000.0", "2000.01")
  name: string;      // plan name text
  amount: number;    // naira
  serviceID: string; // we keep same key for UI compatibility (not used by CK)
  validity: string;  // parsed from name
};

const NETWORK_CODE: Record<string, string> = {
  mtn: "01",
  glo: "02",
  "9mobile": "03",
  airtel: "04",
};

// keep same helper as yours
function extractValidityFromPlanName(name: string): string {
  const n = String(name || "").trim();
  if (!n) return "—";

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

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return `${b}${p}`;
}

function parseMoney(str: any) {
  // "₦404.00" -> 404
  const s = String(str ?? "");
  const cleaned = s.replace(/[₦,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const network = (searchParams.get("network") || "").toLowerCase().trim();

    if (!network) {
      return NextResponse.json({ error: "Missing network" }, { status: 400 });
    }

    const mobileNetwork = NETWORK_CODE[network];
    if (!mobileNetwork) {
      return NextResponse.json({ error: `Unsupported network: ${network}` }, { status: 400 });
    }

    const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim(); // https://www.nellobytesystems.com
    const userId = String(process.env.CLUBKONNECT_USER_ID || "").trim();   // CK101269824

    if (!baseUrl || !userId) {
      return NextResponse.json(
        { error: "Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_USER_ID in .env" },
        { status: 500 }
      );
    }

    // CK plans endpoint (does not require APIKey)
    const url =
      joinUrl(baseUrl, "/APIDatabundlePlansV2.asp") +
      "?" +
      new URLSearchParams({ UserID: userId }).toString();

    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const rawText = await res.text();

    let out: any;
    try {
      out = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json(
        { error: "ClubKonnect returned non-JSON response", raw: rawText },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `ClubKonnect HTTP ${res.status}`, raw: out },
        { status: 502 }
      );
    }

    //  CK response shape can vary:
    // sometimes out.MTN / out.GLO etc, sometimes out.data / out.plans
    // We'll search flexibly.

    const bucketKey =
      network === "mtn" ? "MTN" :
      network === "glo" ? "GLO" :
      network === "airtel" ? "AIRTEL" :
      network === "9mobile" ? "9MOBILE" :
      "";

    const maybeBucket =
      out?.[bucketKey] ||
      out?.[bucketKey?.toLowerCase?.()] ||
      out?.plans ||
      out?.data ||
      out;

    const list: any[] = Array.isArray(maybeBucket) ? maybeBucket : [];

    // Normalize to your Plan[]
    const serviceID = `${network}-data`; // for UI compatibility only

    const rawPlans: Plan[] = list.map((v: any) => {
      // Common CK fields: id / planid / dataplan / code + plan / name + price/amount
      const id = String(
        v?.id ?? v?.planid ?? v?.DataPlan ?? v?.dataplan ?? v?.code ?? ""
      ).trim();

      const name = String(
        v?.name ?? v?.plan ?? v?.description ?? v?.dataplan_name ?? ""
      ).trim();

      const amount =
        Number(v?.amount) ||
        Number(v?.price) ||
        parseMoney(v?.amount_text ?? v?.price_text ?? v?.price_ngn);

      return {
        id,
        name,
        amount: Number.isFinite(amount) ? amount : 0,
        serviceID,
        validity: extractValidityFromPlanName(name),
      };
    });

    // Deduplicate by id
    const seen = new Set<string>();
    const plans = rawPlans.filter((p) => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return NextResponse.json(
      { ok: true, vendor: "clubkonnect", network, mobileNetwork, plans },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
