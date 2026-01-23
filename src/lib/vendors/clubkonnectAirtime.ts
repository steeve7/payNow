// src/lib/vendors/clubkonnectAirtime.ts
export const runtime = "nodejs";

type AirtimeInput = {
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  amount: number;
};

const NETWORK_MAP: Record<AirtimeInput["network"], string> = {
  mtn: "1",
  airtel: "2",
  glo: "3",
  "9mobile": "4",
};

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return `${b}${p}`;
}

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

export async function vendClubKonnectAirtime(input: AirtimeInput) {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();
  const endpoint = String(process.env.CLUBKONNECT_AIRTIME_ENDPOINT || "/airtime/purchase").trim();

  if (!baseUrl || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY");
  }

  const reference = `ck_air_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const url = joinUrl(baseUrl, endpoint);

  // ClubKonnect usually expects digits
  const phone = digitsOnly(input.phone);

  const body = {
    request_id: reference,
    phone,
    network: NETWORK_MAP[input.network],
    amount: Number(input.amount),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // ✅ keep Bearer first (what you had)
        Authorization: `Bearer ${apiKey}`,

        // ✅ add Token header too (some CK endpoints use this)
        Token: apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let out: any = null;
    try {
      out = text ? JSON.parse(text) : null;
    } catch {
      out = { raw_text: text };
    }

    if (!res.ok) {
      throw new Error(
        out?.message ||
          out?.error ||
          out?.raw_text ||
          `ClubKonnect HTTP ${res.status}`
      );
    }

    const msg = String(out?.message || out?.status || "").toLowerCase();
    const ok =
      out?.status === "success" ||
      out?.code === "00" ||
      msg.includes("success") ||
      msg.includes("successful");

    if (!ok) {
      throw new Error(out?.message || "ClubKonnect airtime vending failed");
    }

    return {
      ok: true,
      provider: "clubkonnect" as const,
      reference,
      raw: out,
      debug: { url, endpoint, baseUrl, sent: body, http_status: res.status },
    };
  } catch (e: any) {
    // ✅ fetch() throws "fetch failed" for DNS/TLS/blocked egress
    return {
      ok: false,
      provider: "clubkonnect" as const,
      reference,
      error: e?.message || "fetch failed",
      debug: {
        url,
        endpoint,
        baseUrl,
        sent: body,
        cause: e?.cause ? String(e.cause) : null,
        name: e?.name,
      },
    };
  }
}
