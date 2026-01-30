type VendIntAirtimeInput = {
  billType: "intl_airtime";
  serviceID: string;
  variation_code: string;
  billersCode: string;
  amount: number;
  contact?: string;
};

function makeRef() {
  return `ck_int_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function errorToDebug(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    code: e?.code,
    errno: e?.errno,
    syscall: e?.syscall,
    cause: e?.cause ? String(e.cause) : null,
  };
}

export async function vendClubKonnectIntAirtime(input: VendIntAirtimeInput) {
  const reference = makeRef();
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const endpoint = String(
    process.env.CLUBKONNECT_INTL_AIRTIME_PURCHASE_ENDPOINT ||
      "/international/airtime/purchase"
  ).trim();

  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

  // If not configured, return a clear failure
  if (!baseUrl) {
    return {
      ok: false,
      reference,
      error: "Missing CLUBKONNECT_BASE_URL",
      debug: { baseUrl: null, endpoint, url: null },
    };
  }

  // For now, CK is unreliable — but we still return a consistent object
  try {
    const res = await fetch(url, { method: "POST", cache: "no-store" });
    const out = await res.json().catch(() => ({} as any));
    return { ok: res.ok, reference, raw: out, debug: { url, baseUrl, endpoint } };
  } catch (e: any) {
    return {
      ok: false,
      reference,
      error: e?.message || "check your network",
      debug: { url, endpoint, baseUrl, reference, ...errorToDebug(e) },
    };
  }
}
