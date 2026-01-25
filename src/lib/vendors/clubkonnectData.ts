// src/lib/vendors/clubkonnectData.ts
import type { VendInput } from "./vendData";

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

const CK_NETWORK_CODE: Record<VendInput["network"], string> = {
  mtn: "01",
  glo: "02",
  "9mobile": "03",
  airtel: "04",
};

export async function vendClubKonnectData(input: VendInput) {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const endpoint = String(process.env.CLUBKONNECT_DATA_ENDPOINT || "/APIDatabundleV1.asp").trim();

  const userId = String(process.env.CLUBKONNECT_USER_ID || "").trim();
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();
  const callbackUrl = String(process.env.CLUBKONNECT_CALLBACK_URL || "").trim();

  if (!baseUrl || !userId || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL, CLUBKONNECT_USER_ID or CLUBKONNECT_API_KEY");
  }

  const dataPlan = String(input.ck_plan_code || "").trim();
  if (!dataPlan) {
    throw new Error(
      "ClubKonnect Data failed: Missing ck_plan_code. Fix mapping in /api/bills/data-plans so each plan includes ck_plan_code."
    );
  }

  const requestId = `ck_data_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const mobileNetwork = CK_NETWORK_CODE[input.network];
  const mobileNumber = digitsOnly(input.phone);

  if (!mobileNumber || mobileNumber.length < 10) {
    throw new Error("ClubKonnect Data failed: Invalid recipient phone number");
  }

  const params: Record<string, string> = {
    UserID: userId,
    APIKey: apiKey,
    MobileNetwork: mobileNetwork,
    DataPlan: dataPlan,
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
      out = { raw_text: text };
    }

    if (!res.ok) throw new Error(`ClubKonnect HTTP ${res.status}: ${text || "n/a"}`);

    const status = String(out?.status || "").toUpperCase();
    const statuscode = String(out?.statuscode || "");

    if (status.startsWith("INVALID_") || status.startsWith("MISSING_")) {
      throw new Error(`ClubKonnect failed: ${text || "n/a"}`);
    }

    const ok =
      status === "ORDER_RECEIVED" ||
      status === "ORDER_COMPLETED" ||
      statuscode === "100" ||
      statuscode === "200";

    if (!ok) throw new Error(`ClubKonnect unknown response: ${text || "n/a"}`);

    return {
      ok: true,
      provider: "clubkonnect" as const,
      reference: requestId,
      raw: out,
      debug: {
        url: safeUrl,
        http_status: res.status,
        sent: { MobileNetwork: mobileNetwork, DataPlan: dataPlan, MobileNumber: mobileNumber },
      },
    };
  } catch (e: any) {
    throw new Error(
      `ClubKonnect Data failed: ${e?.message || "fetch failed"} | url: ${safeUrl} | raw: ${text || "n/a"}`
    );
  }
}
