// src/lib/vendors/vtpassAirtime.ts

type AirtimeInput = {
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  amount: number;
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

function digitsOnly(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function mapAirtimeServiceID(network: AirtimeInput["network"]) {
  const map: Record<AirtimeInput["network"], string> = {
    mtn: "mtn",
    airtel: "airtel",
    glo: "glo",
    "9mobile": "etisalat", // VTPass uses "etisalat" for 9mobile
  };
  return map[network];
}

// request_id must start numeric
function makeVtpassRequestId(prefix = "AIRTIME") {
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

export async function vendVTPassAirtime(input: AirtimeInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");
  }

  const serviceID = mapAirtimeServiceID(input.network);
  if (!serviceID) {
    throw new Error(`Unsupported network for VTPass airtime: ${input.network}`);
  }

  const url = `${vtpassBaseUrl()}/pay`;
  const request_id = makeVtpassRequestId("AIRTIME");

  // Some users enter 080... format — keep as-is if you want,
  // but digitsOnly is safer for inconsistent input.
  const phone = digitsOnly(input.phone) || String(input.phone || "").trim();
  const amount = Number(input.amount);

  if (!phone || phone.length < 10) throw new Error("Invalid phone number");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

  const body = {
    request_id,
    serviceID,
    amount,
    phone,
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
      cache: "no-store",
    });

    rawText = await res.text();

    let out: any = null;
    try {
      out = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`VTPass returned non-JSON: ${rawText || "n/a"}`);
    }

    if (!res.ok) {
      throw new Error(out?.response_description || out?.message || "VTPass error");
    }

    const looksSuccess =
      out?.code === "000" ||
      out?.response_code === "000" ||
      String(out?.response_description || "").toLowerCase().includes("successful") ||
      String(out?.response_description || "").toLowerCase().includes("success");

    if (!looksSuccess) {
      throw new Error(out?.response_description || out?.message || "VTPass airtime vending failed");
    }

    // Keep shape consistent for storage/receipt builder
    return {
      reference: request_id,
      provider: "vtpass" as const,
      ...out,
    };
  } catch (e: any) {
    const msg = e?.message || "VTPass airtime vend failed";
    // Ensure you see upstream response if "fetch failed" happens
    throw new Error(msg.includes("fetch failed") ? `VTPass fetch failed. Raw: ${rawText || "n/a"}` : msg);
  }
}
