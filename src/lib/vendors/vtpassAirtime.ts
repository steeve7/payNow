// src/lib/vendors/vtpassAirtime.ts
type AirtimeInput = {
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  amount: number;
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production" ? "https://vtpass.com/api" : "https://sandbox.vtpass.com/api";
}

function mapAirtimeServiceID(network: AirtimeInput["network"]) {
  const map: Record<AirtimeInput["network"], string> = {
    mtn: "mtn",
    airtel: "airtel",
    glo: "glo",
    "9mobile": "etisalat", // ✅ VTPass uses etisalat for 9mobile :contentReference[oaicite:1]{index=1}
  };
  return map[network];
}

// request_id must start numeric (VTPass guide links from their docs)
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
  if (!apiKey || !secretKey) throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");

  const url = `${vtpassBaseUrl()}/pay`;
  const request_id = makeVtpassRequestId("AIRTIME");
  const serviceID = mapAirtimeServiceID(input.network);

  // ✅ VTPass Airtime payload = request_id, serviceID, amount, phone :contentReference[oaicite:2]{index=2}
  const body = {
    request_id,
    serviceID,
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

    const looksSuccess = out?.code === "000" || String(out?.response_description || "").toLowerCase().includes("successful");
    if (!looksSuccess) throw new Error(out?.response_description || out?.message || "VTPass airtime vending failed");

    return { reference: request_id, provider: "vtpass", ...out };
  } catch (e: any) {
    const msg = e?.message || "VTPass airtime vend failed";
    throw new Error(msg.includes("fetch failed") ? `VTPass fetch failed. Raw: ${rawText || "n/a"}` : msg);
  }
}
