// src/lib/vendors/clubkonnectShowmax.ts

export type ShowmaxInput = {
  billType: "showmax";
  serviceID: "showmax";
  variation_code: string;
  billersCode: string;
  amount?: number;
  contact?: string;
};

export type ClubKonnectShowmaxResult = {
  provider: "clubkonnect";
  ok: boolean;
  reference: string;
  raw: any;
  voucherDetails?: { vouchers: string[]; purchased_code?: string };
};

function makeRef() {
  return `ck_smx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function extractVouchers(out: any): { vouchers: string[]; purchased_code?: string } {
  const vouchers: string[] = [];
  const purchased_code = out?.purchased_code || out?.content?.purchased_code;

  const voucherArr = out?.Voucher || out?.content?.Voucher || out?.vouchers || out?.content?.vouchers;
  if (Array.isArray(voucherArr)) {
    voucherArr.forEach((v: any) => {
      const s = String(v || "").trim();
      if (s) vouchers.push(s);
    });
  }

  if (purchased_code) vouchers.push(String(purchased_code).trim());

  return {
    vouchers: Array.from(new Set(vouchers.filter(Boolean))),
    purchased_code: purchased_code ? String(purchased_code) : undefined,
  };
}

export async function vendClubKonnectShowmax(
  input: ShowmaxInput
): Promise<ClubKonnectShowmaxResult> {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();

  //  configurable endpoint (so you can change without code)
  const endpoint = String(
    process.env.CLUBKONNECT_SHOWMAX_ENDPOINT || "/showmax/purchase"
  ).trim();

  const reference = makeRef();

  if (!baseUrl || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env");
  }

  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

  const body: any = {
    request_id: reference,
    serviceID: "showmax",
    variation_code: input.variation_code,
    billersCode: input.billersCode,
  };

  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    body.amount = input.amount;
  }
  if (input.contact) body.contact = input.contact;

  // Timeout protection (important because CK has been timing out)
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let out: any = {};
    try {
      out = text ? JSON.parse(text) : {};
    } catch {
      out = { nonJsonResponse: text };
    }

    if (!res.ok) {
      throw new Error(out?.message || out?.error || "ClubKonnect Showmax request failed");
    }

    const looksSuccess =
      out?.status === "success" ||
      out?.code === "00" ||
      String(out?.message || "").toLowerCase().includes("success");

    if (!looksSuccess) {
      throw new Error(out?.message || "ClubKonnect Showmax vending failed");
    }

    const voucherDetails = extractVouchers(out);

    return {
      provider: "clubkonnect",
      ok: true,
      reference,
      raw: out,
      voucherDetails,
    };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? `ClubKonnect timeout. url=${url}`
        : e?.message || "ClubKonnect Showmax failed";

    // throw so verify route marks vend failed
    throw new Error(
      `${msg} | debug=${JSON.stringify({
        url,
        endpoint,
        baseUrl,
        reference,
      })}`
    );
  } finally {
    clearTimeout(t);
  }
}
