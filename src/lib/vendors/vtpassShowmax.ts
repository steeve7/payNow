// src/lib/vendors/vtpassShowmax.ts

type ShowmaxInput = {
  billType: "showmax";
  serviceID: "showmax";
  variation_code: string;
  billersCode: string; // phone number
  amount?: number;
  contact?: string;
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

function makeVtpassRequestId(prefix = "SMX") {
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

function extractVouchers(out: any): { vouchers: string[]; purchased_code?: string } {
  const vouchers: string[] = [];

  const purchased_code = out?.content?.purchased_code || out?.purchased_code;

  const voucherArr = out?.Voucher || out?.content?.Voucher;
  if (Array.isArray(voucherArr)) {
    voucherArr.forEach((v: any) => {
      const s = String(v || "").trim();
      if (s) vouchers.push(s);
    });
  }

  if (purchased_code) {
    const s = String(purchased_code).trim();
    if (s) vouchers.push(s);
  }

  return {
    vouchers: Array.from(new Set(vouchers)),
    purchased_code: purchased_code ? String(purchased_code) : undefined,
  };
}

export async function vendVTPassShowmax(input: ShowmaxInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");
  }

  const url = `${vtpassBaseUrl()}/pay`;
  const request_id = makeVtpassRequestId("SMX");

  const body: any = {
    request_id,
    serviceID: "showmax",
    billersCode: input.billersCode,
    variation_code: input.variation_code,
  };

  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    body.amount = input.amount;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "secret-key": secretKey,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let out: any = {};
  try {
    out = rawText ? JSON.parse(rawText) : {};
  } catch {
    out = { nonJsonResponse: rawText };
  }

  if (!res.ok) {
    throw new Error(out?.response_description || out?.message || "VTPass error");
  }

  const looksSuccess =
    out?.code === "000" ||
    String(out?.response_description || "").toLowerCase().includes("successful");

  if (!looksSuccess) {
    throw new Error(out?.response_description || out?.message || "Showmax vending failed");
  }

  const voucherDetails = extractVouchers(out);

  return {
    reference: request_id,
    provider: "vtpass",
    voucherDetails,
    ...out,
  };
}
