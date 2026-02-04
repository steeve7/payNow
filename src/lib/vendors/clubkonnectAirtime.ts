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

function ckUserMessage(status: string) {
  const s = String(status || "").trim().toUpperCase();
  if (!s) return "ClubKonnect vending failed";
  return `${s} from clubkonnect`;
}

export async function vendClubKonnectAirtime(input: AirtimeInput) {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const endpoint = String(
    process.env.CLUBKONNECT_AIRTIME_ENDPOINT || "/APIAirtimeV1.asp"
  ).trim();

  const userId = String(process.env.CLUBKONNECT_USER_ID || "").trim();
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();
  const callbackUrl = String(process.env.CLUBKONNECT_CALLBACK_URL || "").trim();

  if (!baseUrl || !endpoint || !userId || !apiKey) {
    throw new Error("ClubKonnect config missing");
  }

  const requestId = `ck_air_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;

  const NETWORK_CODE: Record<AirtimeInput["network"], string> = {
    mtn: "01",
    glo: "02",
    "9mobile": "03",
    airtel: "04",
  };

  const mobileNumber = digitsOnly(input.phone);
  const amount = Number(input.amount);
  const mobileNetwork = NETWORK_CODE[input.network];

  if (!mobileNumber || mobileNumber.length < 10) {
    throw new Error("Invalid phone number");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
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

  const url =
    joinUrl(baseUrl, endpoint) + "?" + new URLSearchParams(params).toString();
  const safeUrl = redactApiKey(url);

  let text = "";
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    text = await res.text();

    let out: any;
    try {
      out = text ? JSON.parse(text) : {};
    } catch {
      out = { raw_text: text };
    }

    // log details on server ONLY
    if (!res.ok) {
      console.error("[clubkonnect airtime] HTTP fail", {
        status: res.status,
        safeUrl,
        text,
      });
      throw new Error("ClubKonnect HTTP error");
    }

    const status = String(out?.status || "").trim().toUpperCase();
    const statuscode = String(out?.statuscode || "").trim();

    // Known success statuses
    const ok =
      status === "ORDER_RECEIVED" ||
      status === "ORDER_COMPLETED" ||
      status === "DELIVERED" ||
      statuscode === "100" ||
      statuscode === "200";

    if (!ok) {
      // Clean message to UI
      const msg = ckUserMessage(status);

      // keep verbose details in server logs
      console.warn("[clubkonnect airtime] fail", {
        msg,
        status,
        statuscode,
        safeUrl,
        out,
      });

      throw new Error(msg);
    }

    return {
      ok: true,
      provider: "clubkonnect" as const,
      reference: requestId,
      raw: out,
      debug: {
        url: safeUrl,
        http_status: res.status,
      },
    };
  } catch (e: any) {
    // NEVER include url/raw in thrown message
    const msg = e?.message || "ClubKonnect vending failed";

    // keep details in logs for debugging
    console.error("[clubkonnect airtime] exception", {
      msg,
      safeUrl,
      raw: text || "n/a",
    });

    throw new Error(msg);
  }
}
