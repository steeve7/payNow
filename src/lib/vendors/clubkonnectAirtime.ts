// src/lib/vendors/clubkonnectAirtime.ts
export const runtime = "nodejs";

type AirtimeInput = {
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  amount: number;
};

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return `${b}${p}`;
}

function redactApiKey(url: string) {
  return url.replace(/(APIKey=)[^&]+/i, "$1REDACTED");
}

export async function vendClubKonnectAirtime(input: AirtimeInput) {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim(); // https://www.nellobytesystems.com
  const endpoint = String(
    process.env.CLUBKONNECT_AIRTIME_ENDPOINT || "/APIAirtimeV1.asp"
  ).trim();

  const userId = String(process.env.CLUBKONNECT_USER_ID || "").trim(); // CK101269824
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();

  // Optional callback (docs say they call it with query params or JSON)
  const callbackUrl = String(process.env.CLUBKONNECT_CALLBACK_URL || "").trim();

  if (!baseUrl || !endpoint || !userId || !apiKey) {
    throw new Error(
      "Missing CLUBKONNECT_BASE_URL, CLUBKONNECT_AIRTIME_ENDPOINT, CLUBKONNECT_USER_ID or CLUBKONNECT_API_KEY"
    );
  }

  const requestId = `ck_air_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;

  //  EXACT codes from your docs
  const NETWORK_CODE: Record<AirtimeInput["network"], string> = {
    mtn: "01",
    glo: "02",
    "9mobile": "03",
    airtel: "04",
  };

  const mobileNumber = digitsOnly(input.phone);
  const amount = Number(input.amount);
  const mobileNetwork = NETWORK_CODE[input.network];

  // Basic sanity checks (avoid sending junk)
  if (!mobileNumber || mobileNumber.length < 10) {
    throw new Error("ClubKonnect Airtime failed: Invalid recipient phone number");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("ClubKonnect Airtime failed: Invalid amount");
  }

  const params: Record<string, string> = {
    UserID: userId,
    APIKey: apiKey,
    MobileNetwork: mobileNetwork,
    Amount: String(amount),
    MobileNumber: mobileNumber,
    RequestID: requestId,
  };

  if (callbackUrl) params.CallBackURL = callbackUrl;

  const url = joinUrl(baseUrl, endpoint) + "?" + new URLSearchParams(params).toString();
  const safeUrl = redactApiKey(url);

  let text = "";
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    text = await res.text();

    let out: any;
    try {
      out = text ? JSON.parse(text) : {};
    } catch {
      // Docs say JSON always, but keep this for safety
      out = { raw_text: text };
    }

    // If HTTP layer failed
    if (!res.ok) {
      throw new Error(`ClubKonnect HTTP ${res.status}: ${text || "n/a"}`);
    }

    // Docs: responses include status + sometimes statuscode
    const status = String(out?.status || "").toUpperCase();
    const statuscode = String(out?.statuscode || "");

    // Explicit failures (docs list)
    if (status.startsWith("INVALID_") || status.startsWith("MISSING_")) {
      throw new Error(`ClubKonnect failed: ${text || "n/a"}`);
    }

    // Accept "ORDER_RECEIVED" as success (means queued/accepted)
    const ok =
      status === "ORDER_RECEIVED" ||
      status === "ORDER_COMPLETED" ||
      status === "DELIVERED" ||
      statuscode === "100" || // usually ORDER_RECEIVED
      statuscode === "200"; // usually ORDER_COMPLETED

    if (!ok) {
      // Unknown status – throw so you can see it and we map it
      throw new Error(`ClubKonnect unknown response: ${text || "n/a"}`);
    }

    return {
      ok: true,
      provider: "clubkonnect" as const,
      reference: requestId,
      raw: out,
      debug: {
        url: safeUrl,
        sent: {
          UserID: userId,
          MobileNetwork: mobileNetwork,
          Amount: amount,
          MobileNumber: mobileNumber,
          RequestID: requestId,
          CallBackURL: callbackUrl ? "(set)" : "(not set)",
        },
        http_status: res.status,
      },
    };
  } catch (e: any) {
    // IMPORTANT: do not leak APIKey to DB logs/errors
    throw new Error(
      `ClubKonnect Airtime failed: ${e?.message || "check your network"} | url: ${safeUrl} | raw: ${
        text || "n/a"
      }`
    );
  }
}
