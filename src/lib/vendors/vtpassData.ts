// src/lib/vendors/vtpassData.ts
import type { VendInput } from "./vendData";

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// Keep this consistent with what you store in payload/serviceID from initiate
function mapVTPassServiceID(network: VendInput["network"]) {
  const map: Record<VendInput["network"], string> = {
    mtn: "mtn-data",
    airtel: "airtel-data",
    glo: "glo-data",
    "9mobile": "9mobile-data",
  };
  return map[network];
}

// VTPass wants request_id starting with 12 numeric digits (YYYYMMDDHHmm) Lagos time :contentReference[oaicite:4]{index=4}
function makeVtpassRequestId(prefix = "PAYNOW") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const yyyymmddhhmm = `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`; // 12 digits
  const rand = Math.random().toString(16).slice(2);
  return `${yyyymmddhhmm}${prefix}${rand}`; // 12+ chars, starts numeric
}

export async function vendVTPassData(input: VendInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");
  }

  const serviceID = input.serviceID || mapVTPassServiceID(input.network);
  if (!serviceID) throw new Error(`Unsupported network for VTPass: ${input.network}`);

  const url = `${vtpassBaseUrl()}/pay`;

  const request_id = makeVtpassRequestId("DATA");

  const body = {
    request_id,
    serviceID,
    billersCode: input.phone,
    variation_code: input.plan_code,
    amount: input.amount,
    phone: input.phone,
  };

  let rawText = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ✅ VTPass POST auth must be api-key + secret-key :contentReference[oaicite:5]{index=5}
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      body: JSON.stringify(body),
    });

    rawText = await res.text();

    let out: any = null;
    try {
      out = JSON.parse(rawText);
    } catch {
      // Now you’ll see the real upstream response instead of “fetch failed”
      throw new Error(`VTPass returned non-JSON: ${rawText}`);
    }

    if (!res.ok) {
      throw new Error(out?.response_description || out?.message || "VTPass error");
    }

    const looksSuccess =
      out?.code === "000" ||
      out?.response_code === "000" ||
      String(out?.status || "").toLowerCase().includes("success");

    if (!looksSuccess) {
      throw new Error(out?.response_description || out?.message || "VTPass vending failed");
    }

    return {
      reference: request_id,
      provider: "vtpass",
      ...out,
    };
  } catch (e: any) {
    // Make sure the error is never a silent “fetch failed”
    const msg = e?.message || "VTPass vend failed";
    throw new Error(msg.includes("fetch failed") ? `VTPass fetch failed. Raw: ${rawText || "n/a"}` : msg);
  }
}
