// src/lib/vendors/vendIntlAirtime.ts
import {
  vendVtpassIntlAirtime,
  type VtpassIntlAirtimeInput,
} from "./vtpassIntAirtime";

export type IntlServiceID = "foreign-airtime" | "foreign-data" | "foreign-pin";

export type VendIntlAirtimeInput = {
  billType: "intl_airtime";

  email: string;
  phone: string;
  billersCode: string;
  amount: number;

  // now supports multiple
  serviceID: string;

  variation_code: string;

  country_code: string; // "NG"
  country: string; // "Nigeria"

  operator_id: string; // "1"
  operator: string; // "Nigeria MTN" or "MTN"

  product_type_id: string; // "4"

  contact?: string;
};

export type VendIntlAirtimeResult =
  | { provider: "vtpass"; ok: true; reference: string; raw: any; debug: any }
  | {
      provider: "vtpass";
      ok: false;
      reference: string | null;
      raw: any;
      error: any;
      debug?: any;
    };

const allowedServiceIDs = new Set<IntlServiceID>([
  "foreign-airtime",
  "foreign-data",
  "foreign-pin",
]);

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function missingFields(input: Partial<VendIntlAirtimeInput>) {
  const missing: string[] = [];

  if (!input.email || !String(input.email).trim()) missing.push("email");

  const phoneDigits = digitsOnly(input.phone);
  const bcDigits = digitsOnly(input.billersCode);

  if (!phoneDigits || phoneDigits.length < 8) missing.push("phone");
  if (!bcDigits || bcDigits.length < 8) missing.push("billersCode");

  const amt = Number(input.amount);
  if (!Number.isFinite(amt) || amt <= 0) missing.push("amount");

  const sid = String(input.serviceID || "").trim() as IntlServiceID;
  if (!sid || !allowedServiceIDs.has(sid)) missing.push("serviceID");

  if (!input.variation_code || !String(input.variation_code).trim())
    missing.push("variation_code");

  if (!input.country_code || !String(input.country_code).trim())
    missing.push("country_code");
  if (!input.country || !String(input.country).trim()) missing.push("country");

  if (!input.operator_id || !String(input.operator_id).trim())
    missing.push("operator_id");
  if (!input.operator || !String(input.operator).trim()) missing.push("operator");

  if (!input.product_type_id || !String(input.product_type_id).trim())
    missing.push("product_type_id");

  return missing;
}

export async function vendIntAirtime(
  input: VendIntlAirtimeInput
): Promise<VendIntlAirtimeResult> {
  const missing = missingFields(input);

  if (missing.length) {
    return {
      provider: "vtpass",
      ok: false,
      reference: null,
      raw: {
        error: "Missing required payload fields for intl_airtime",
        payload: input,
        missingFields: missing,
      },
      error: `Missing fields: ${missing.join(", ")}`,
    };
  }

  const vtpassPayload: VtpassIntlAirtimeInput = {
    serviceID: String(input.serviceID).trim() as IntlServiceID, //  dynamic

    country_code: String(input.country_code).trim().toUpperCase(),
    country: String(input.country).trim(),

    operator_id: String(input.operator_id).trim(),
    operator: String(input.operator).trim(),

    product_type_id: String(input.product_type_id).trim(),
    variation_code: String(input.variation_code).trim(),

    phone: digitsOnly(input.phone),
    billersCode: digitsOnly(input.billersCode),

    email: String(input.email).trim(),

    contact: input.contact ? String(input.contact).trim() : "",
    amount: Number(input.amount),
  };

  const r = await vendVtpassIntlAirtime(vtpassPayload);

  if (!r.ok) {
    return {
      provider: "vtpass",
      ok: false,
      reference: r.reference ?? null,
      raw: r.raw,
      error: r.error,
      debug: r.debug,
    };
  }

  return {
    provider: "vtpass",
    ok: true,
    reference: r.reference,
    raw: r.raw,
    debug: r.debug,
  };
}
