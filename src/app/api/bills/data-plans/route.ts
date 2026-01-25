import { NextResponse } from "next/server";

const NETWORK_TO_VTPASS_SERVICE_ID: Record<string, string> = {
  mtn: "mtn-data",
  airtel: "airtel-data",
  glo: "glo-data",
  "9mobile": "9mobile-data",
};

type Plan = {
  id: string;        // vtpass variation_code
  name: string;
  amount: number;
  fixedPrice?: boolean;
  serviceID: string;
  validity: string;

  //  add this for CK fallback
  ck_plan_code?: string; // ck PRODUCT_ID, e.g. "100.01"
};

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

function parseBundleKey(name: string) {
  // Normalize "110MB", "1.5GB", "7GB" => "110mb", "1.5gb", "7gb"
  const s = String(name || "").toLowerCase();
  const m = s.match(/(\d+(\.\d+)?)\s*(mb|gb)\b/);
  if (!m) return "";
  return `${m[1]}${m[3]}`; // e.g. "110mb"
}

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function normalizeCkPlans(raw: any) {
  // returns: { mtn: [{id, name, amount, key}], glo: [...], airtel: [...], '9mobile': [...] }
  const out: Record<string, Array<{ id: string; name: string; amount: number; key: string }>> = {
    mtn: [],
    glo: [],
    airtel: [],
    "9mobile": [],
  };

  const root = raw?.MOBILE_NETWORK;
  if (!root || typeof root !== "object") return out;

  // Map keys from CK to our network strings
  const KEY_MAP: Record<string, keyof typeof out> = {
    MTN: "mtn",
    GLO: "glo",
    Airtel: "airtel",
    "9mobile": "9mobile",
    "9Mobile": "9mobile",
    "9MOBILE": "9mobile",
    ETISALAT: "9mobile",
  };

  for (const ckNetworkKey of Object.keys(root)) {
    const nKey = KEY_MAP[ckNetworkKey] || null;
    if (!nKey) continue;

    const arr = root[ckNetworkKey];
    if (!Array.isArray(arr)) continue;

    // arr contains objects like { ID: "01", PRODUCT: [ ... ] }
    for (const block of arr) {
      const products = block?.PRODUCT;
      if (!Array.isArray(products)) continue;

      for (const p of products) {
        const id = String(p?.PRODUCT_ID || "").trim();
        const name = String(p?.PRODUCT_NAME || "").trim();
        const amount = Number(String(p?.PRODUCT_AMOUNT || "0").replace(/,/g, "")) || 0;
        const key = parseBundleKey(name);

        if (!id || !name) continue;

        out[nKey].push({ id, name, amount, key });
      }
    }
  }

  return out;
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

    // ---------------- VTPASS FETCH ----------------
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

    const vtRes = await fetch(
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

    const vtText = await vtRes.text();
    const vtOut = safeJson(vtText);

    if (!vtOut) {
      return NextResponse.json(
        { error: "VTPass returned non-JSON response", raw: vtText },
        { status: 502 }
      );
    }

    if (!vtRes.ok) {
      return NextResponse.json(
        {
          error: vtOut?.response_description || vtOut?.message || "VTPass error",
          raw: vtOut,
        },
        { status: 502 }
      );
    }

    const variations: any[] = vtOut?.content?.variations || [];

    const rawPlans: Plan[] = variations.map((v: any) => {
      const name = String(v?.name || "").trim();
      return {
        id: String(v?.variation_code || "").trim(),
        name,
        amount: Number(v?.variation_amount || 0),
        fixedPrice: Boolean(v?.fixedPrice),
        serviceID,
        validity: extractValidityFromPlanName(name),
      };
    });

    // Deduplicate by id
    const seen = new Set<string>();
    let plans: Plan[] = rawPlans.filter((p) => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    // ---------------- CK FETCH + MAP ----------------
    const ckBaseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim(); // https://www.nellobytesystems.com
    const ckUserId = String(process.env.CLUBKONNECT_USER_ID || "").trim();   // CK101269824

    if (ckBaseUrl && ckUserId) {
      const ckPlansUrl =
        ckBaseUrl.replace(/\/+$/, "") +
        `/APIDatabundlePlansV2.asp?UserID=${encodeURIComponent(ckUserId)}`;

      const ckRes = await fetch(ckPlansUrl, { method: "GET", cache: "no-store" });
      const ckText = await ckRes.text();
      const ckOut = safeJson(ckText);

      if (ckOut) {
        const ckNormalized = normalizeCkPlans(ckOut);
        const ckList = ckNormalized[network] || [];

        // Build lookup by key first: "110mb" -> [{id,amount,name},...]
        const byKey = new Map<string, Array<{ id: string; amount: number; name: string }>>();
        for (const c of ckList) {
          if (!c.key) continue;
          byKey.set(c.key, [...(byKey.get(c.key) || []), { id: c.id, amount: c.amount, name: c.name }]);
        }

        plans = plans.map((p) => {
          const key = parseBundleKey(p.name);
          if (!key) return p;

          const candidates = byKey.get(key) || [];
          if (!candidates.length) return p;

          // Pick closest by amount (since VT price and CK price can differ)
          const best = candidates
            .map((c) => ({ c, diff: Math.abs(Number(p.amount) - Number(c.amount)) }))
            .sort((a, b) => a.diff - b.diff)[0]?.c;

          return { ...p, ck_plan_code: best?.id || "" };
        });
      }
    }

    return NextResponse.json({ ok: true, network, serviceID, plans }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
