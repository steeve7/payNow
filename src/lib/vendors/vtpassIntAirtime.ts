// src/lib/vendors/vtpassIntAirtime.ts
export const runtime = "nodejs";

export type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";

export type VtpassIntlAirtimeInput = {
  serviceID: IntlServiceID;

  country_code: string;      // ISO2 e.g. "NG"
  operator_id: string;       // e.g. "1"
  product_type_id: string;   // "1" airtime | "4" data
  variation_code: string;

  billersCode: string;       // E.164 digits WITHOUT "+"
  phone: string;             // E.164 digits WITHOUT "+"

  email: string;
  contact?: string;

  // app-only metadata (NOT sent)
  country?: string;
  operator?: string;

  amount?: number;
};

export type VtpassIntlAirtimeResult =
  | {
      ok: true;
      provider: "vtpass";
      reference: string;
      raw: any;
      debug: any;
    }
  | {
      ok: false;
      provider: "vtpass";
      reference: string | null;
      raw: any;
      error: any;
      debug: any;
    };

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

function makeRequestId() {
  const r = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
  return `${Date.now()}${r}IA`;
}

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function mustE164(name: string, v: unknown) {
  const d = digitsOnly(v);
  if (!d || d.length < 10 || d.length > 15 || d.startsWith("0")) {
    throw new Error(`${name} must be E.164 digits (e.g. 2349138307392)`);
  }
  return d;
}

function must(v: unknown, name: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Missing ${name}`);
  return s;
}

export async function vendVtpassIntlAirtime(
  input: VtpassIntlAirtimeInput
): Promise<VtpassIntlAirtimeResult> {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;

  const request_id = makeRequestId();
  const url = `${vtpassBaseUrl()}/pay`;

  if (!apiKey || !secretKey) {
    return {
      ok: false,
      provider: "vtpass",
      reference: null,
      raw: null,
      error: "Missing VTPASS keys",
      debug: { sent: null },
    };
  }

  const sent = {
    request_id,

    // 🔴 THIS IS THE MOST IMPORTANT LINE
    serviceID: must(input.serviceID, "serviceID") as IntlServiceID,

    country_code: must(input.country_code, "country_code").toUpperCase(),
    operator_id: must(input.operator_id, "operator_id"),
    product_type_id: must(input.product_type_id, "product_type_id"),
    variation_code: must(input.variation_code, "variation_code"),

    phone: mustE164("phone", input.phone),
    billersCode: mustE164("billersCode", input.billersCode),

    email: must(input.email, "email"),
  } as any;

  if (input.contact?.trim()) sent.contact = input.contact.trim();
  if (typeof input.amount === "number" && input.amount > 0)
    sent.amount = input.amount;

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

  const out = await res.json().catch(() => ({}));
  const ok = out?.response_description === "000" || out?.code === "000";

  if (!ok) {
    return {
      ok: false,
      provider: "vtpass",
      reference: request_id,
      raw: out,
      error: out?.content?.errors ?? out,
      debug: { url, sent, status: res.status },
    };
  }

  return {
    ok: true,
    provider: "vtpass",
    reference: request_id,
    raw: out,
    debug: { url, sent, status: res.status },
  };
}
