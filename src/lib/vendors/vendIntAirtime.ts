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

  serviceID: IntlServiceID;
  variation_code: string;

  country_code: string;
  country: string;

  operator_id: string;
  operator: string;

  product_type_id: string;

  contact?: string;
};

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function isLocal(d: string) {
  return d.startsWith("0");
}

export async function vendIntAirtime(
  input: VendIntlAirtimeInput
) {
  const phone = digitsOnly(input.phone);
  const billers = digitsOnly(input.billersCode);

  if (isLocal(phone) || isLocal(billers)) {
    return {
      ok: false,
      provider: "vtpass",
      reference: null,
      raw: input,
      error:
        "Intl numbers must be E.164 digits (234...), not local 0xxxxxxxxxx",
    };
  }

  const vtpassPayload: VtpassIntlAirtimeInput = {
    serviceID: input.serviceID,

    country_code: input.country_code,
    country: input.country,

    operator_id: input.operator_id,
    operator: input.operator,

    product_type_id: input.product_type_id,
    variation_code: input.variation_code,

    phone,
    billersCode: billers,

    email: input.email,
    contact: input.contact,
    amount: input.amount,
  };

  const r = await vendVtpassIntlAirtime(vtpassPayload);

  // 🔥 HARD ASSERT: serviceID must never change
  const sentService = r?.debug?.sent?.serviceID;
  if (sentService && sentService !== input.serviceID) {
    return {
      ok: false,
      provider: "vtpass",
      reference: r.reference ?? null,
      raw: r.raw,
      error: `SERVICE_ID MISMATCH: expected ${input.serviceID}, sent ${sentService}`,
      debug: r.debug,
    };
  }

  return r;
}
