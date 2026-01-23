// src/lib/vendors/vtpassElectricity.ts
type ElectricityInput = {
  billType: "electricity";
  serviceID: string;
  meterType: "prepaid" | "postpaid";
  meterNumber: string;
  phone: string;
  amount: number;
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// request_id must start numeric (same pattern you used)
function makeVtpassRequestId(prefix = "ELEC") {
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

  const yyyymmddhhmm = `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
  const rand = Math.random().toString(16).slice(2);
  return `${yyyymmddhhmm}${prefix}${rand}`;
}

/**
 * Best-effort token extraction because VTPass responses vary by DISCO / product.
 * We search common keys inside:
 * - out.content.*
 * - out.content.transactions.*
 * - out.purchased_code / out.token / out.units / out.amount etc.
 */
function extractElectricityTokenDetails(out: any) {
  const c = out?.content ?? {};
  const t = c?.transactions ?? c?.transaction ?? {};

  const pick = (...vals: any[]) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
    }
    return "";
  };

  const pickNum = (...vals: any[]) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  // Common token fields (names differ across vendors)
  const token =
    pick(
      c?.token,
      c?.Token,
      t?.token,
      t?.Token,
      out?.token,
      out?.Token,
      out?.purchased_code,
      out?.Purchased_code,
      out?.purchasedCode
    ) || null;

  const units =
    pickNum(
      c?.units,
      c?.Units,
      t?.units,
      t?.Units,
      out?.units,
      out?.Units,
      c?.kwH,
      t?.kwH,
      out?.kwH
    );

  const amount =
    pickNum(
      c?.amount,
      t?.amount,
      out?.amount,
      c?.Amount,
      t?.Amount,
      out?.Amount
    );

  const customerName =
    pick(
      c?.Customer_Name,
      c?.customer_name,
      out?.customer_name,
      out?.Customer_Name
    ) || null;

  const meterNumber =
    pick(
      c?.meter_number,
      c?.Meter_Number,
      t?.meter_number,
      out?.meter_number
    ) || null;

  // Some responses include an address or disco-specific fields
  const customerAddress =
    pick(
      c?.Customer_Address,
      c?.customer_address,
      out?.customer_address,
      out?.Customer_Address
    ) || null;

  // If nothing meaningful, return null
  const hasAnything = !!token || units !== null || amount !== null || !!customerName || !!meterNumber || !!customerAddress;

  return hasAnything
    ? {
        token,
        units,
        amount,
        customerName,
        meterNumber,
        customerAddress,
      }
    : null;
}

export async function vendVTPassElectricity(input: ElectricityInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");
  }

  const url = `${vtpassBaseUrl()}/pay`;
  const request_id = makeVtpassRequestId("ELEC");

  // ✅ VTPass electricity vending payload
  const body = {
    request_id,
    serviceID: input.serviceID,
    billersCode: input.meterNumber,
    variation_code: input.meterType, // prepaid | postpaid
    amount: input.amount,
    phone: input.phone,
  };

  let rawText = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "secret-key": secretKey,
      },
      body: JSON.stringify(body),
    });

    rawText = await res.text();
    const out = JSON.parse(rawText);

    if (!res.ok) throw new Error(out?.response_description || out?.message || "VTPass error");

    const looksSuccess =
      out?.code === "000" ||
      String(out?.response_description || "").toLowerCase().includes("successful");

    if (!looksSuccess) {
      throw new Error(out?.response_description || out?.message || "VTPass electricity vending failed");
    }

    // ✅ Extract token details (best effort)
    const tokenDetails = extractElectricityTokenDetails(out);

    return {
      reference: request_id,
      provider: "vtpass",
      tokenDetails, // ✅ this is what we want saved in vend_response
      ...out,        // raw VTPass response
    };
  } catch (e: any) {
    const msg = e?.message || "VTPass electricity vend failed";
    throw new Error(msg.includes("fetch failed") ? `VTPass fetch failed. Raw: ${rawText || "n/a"}` : msg);
  }
}
