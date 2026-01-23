// src/lib/vendors/vtpassIntAirtime.ts
export const runtime = "nodejs";

export type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";

export type VtpassIntlAirtimeInput = {
  // UI can pass foreign-data etc, but purchase uses foreign-airtime
  serviceID: IntlServiceID;

  country_code: string; // e.g. "NG"
  operator_id: string;  // e.g. "1"
  product_type_id: string; // "1" topup, "4" data, etc
  variation_code: string;  // e.g. "17299"

  billersCode: string; // recipient phone digits
  phone: string;       // recipient phone digits

  email: string;       // required by VTPass
  contact?: string;

  amount?: number;     // optional (safe to include for fixed bundles)
};

export type VtpassIntlAirtimeResult =
  | {
      ok: true;
      provider: "vtpass";
      reference: string;
      raw: any;
      debug: {
        url: string;
        sent: any;
        status: number;
        provider: "vtpass";
        request_id: string;
      };
    }
  | {
      ok: false;
      provider: "vtpass";
      reference: string | null;
      raw: any;
      error: any;
      debug: {
        url: string;
        sent: any;
        status: number;
        provider: "vtpass";
        request_id: string;
      };
    };

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// request_id must start numeric
function makeVtpassRequestId(suffix = "IA") {
  const rand = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
  return `${Date.now()}${rand}${suffix}`;
}

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function mustNonEmpty(name: string, v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Missing/invalid ${name}`);
  return s;
}

function mustDigits(name: string, v: unknown, minLen = 8, maxLen = 20) {
  const d = digitsOnly(v);
  if (!d || d.length < minLen || d.length > maxLen) {
    throw new Error(`Missing/invalid ${name}`);
  }
  return d;
}

// ✅ NG E.164 -> local 0xxxxxxxxxx
function toNgLocal(raw: string) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) return `0${d.slice(3)}`;
  if (!d.startsWith("0") && d.length === 10) return `0${d}`;
  return d;
}

export async function vendVtpassIntlAirtime(
  input: VtpassIntlAirtimeInput
): Promise<VtpassIntlAirtimeResult> {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;

  const url = `${vtpassBaseUrl()}/pay`;
  const request_id = makeVtpassRequestId("IA");

  if (!apiKey || !secretKey) {
    return {
      ok: false,
      provider: "vtpass",
      reference: null,
      raw: { error: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
      error: { message: "Missing VTPASS_API_KEY or VTPASS_SECRET_KEY" },
      debug: { url, sent: null, status: 0, provider: "vtpass", request_id },
    };
  }

  // ✅ Purchase uses foreign-airtime (even for data bundles in intl flow)
  const serviceID = "foreign-airtime";

  const email = mustNonEmpty("email", input.email);

  const country_code = mustNonEmpty("country_code", input.country_code).toUpperCase();
  const operator_id = mustNonEmpty("operator_id", input.operator_id);
  const product_type_id = mustNonEmpty("product_type_id", input.product_type_id);
  const variation_code = mustNonEmpty("variation_code", input.variation_code);

  // digits (E.164 digits, no +)
  const rawPhoneDigits = mustDigits("phone", input.phone, 8, 20);
  const rawBillersDigits = mustDigits("billersCode", input.billersCode, 8, 20);

  // ✅ normalize
  let phone = digitsOnly(rawPhoneDigits);
  let billersCode = digitsOnly(rawBillersDigits);

  if (country_code === "NG") {
    phone = toNgLocal(phone);
    billersCode = toNgLocal(billersCode);
  }

  // ✅ (optional) basic sanity check after normalize
  if (country_code === "NG") {
    if (!phone.startsWith("0") || phone.length !== 11) {
      throw new Error("NG phone normalization failed (expected 11 digits starting with 0)");
    }
    if (!billersCode.startsWith("0") || billersCode.length !== 11) {
      throw new Error("NG billersCode normalization failed (expected 11 digits starting with 0)");
    }
  }

  const sent: any = {
    request_id,
    serviceID,
    billersCode,
    variation_code,
    phone,
    operator_id,
    country_code,
    product_type_id,
    email,
  };

  if (input.contact && String(input.contact).trim()) {
    sent.contact = String(input.contact).trim();
  }

  if (typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0) {
    sent.amount = input.amount;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "secret-key": secretKey,
    },
    body: JSON.stringify(sent),
    cache: "no-store",
  });

  const out = await res.json().catch(() => ({} as any));

  const ok = out?.response_description === "000" || out?.code === "000";

  if (!ok) {
    return {
      ok: false,
      provider: "vtpass",
      reference: request_id,
      raw: out,
      error: out?.content?.errors ?? out?.content ?? out,
      debug: { url, sent, status: res.status, provider: "vtpass", request_id },
    };
  }

  return {
    ok: true,
    provider: "vtpass",
    reference: request_id,
    raw: out,
    debug: { url, sent, status: res.status, provider: "vtpass", request_id },
  };
}
