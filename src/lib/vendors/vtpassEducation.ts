type EducationInput = {
  billType: "education";
  serviceID: string;
  variation_code: string;
  phone: string;
  amount?: number;
  quantity?: number;
  contact?: string;
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// request_id must start numeric (same pattern you used)
function makeVtpassRequestId(prefix = "EDU") {
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

function extractPins(out: any): { pins: string[]; purchased_code?: string } {
  const pins: string[] = [];

  // WAEC Registration docs show purchased_code + tokens[] :contentReference[oaicite:5]{index=5}
  const purchased_code = out?.content?.purchased_code || out?.purchased_code;

  const tokens = out?.content?.tokens || out?.tokens;
  if (Array.isArray(tokens)) {
    tokens.forEach((t: any) => {
      const s = String(t || "").trim();
      if (s) pins.push(s);
    });
  }

  // Some education responses come as cards[]
  const cards = out?.content?.cards || out?.cards;
  if (Array.isArray(cards)) {
    cards.forEach((c: any) => {
      const p = String(c?.Pin || c?.pin || c?.PIN || "").trim();
      if (p) pins.push(p);
    });
  }

  // If purchased_code contains a PIN-like string, keep it too
  if (purchased_code && pins.length === 0) {
    const s = String(purchased_code).trim();
    if (s) pins.push(s);
  }

  return { pins: Array.from(new Set(pins)), purchased_code: purchased_code ? String(purchased_code) : undefined };
}

export async function vendVTPassEducation(input: EducationInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");

  const url = `${vtpassBaseUrl()}/pay`; // VTPass education purchase uses /pay :contentReference[oaicite:6]{index=6}
  const request_id = makeVtpassRequestId("EDU");

  const body: any = {
    request_id,
    serviceID: input.serviceID,
    variation_code: input.variation_code,
    phone: input.phone,
  };

  // optional fields (safe)
  if (typeof input.amount === "number" && Number.isFinite(input.amount)) body.amount = input.amount;
  if (typeof input.quantity === "number" && input.quantity > 0) body.quantity = input.quantity;

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

    if (!looksSuccess) throw new Error(out?.response_description || out?.message || "VTPass education vending failed");

    const pinDetails = extractPins(out);

    return {
      reference: request_id,
      provider: "vtpass",
      pinDetails,
      ...out,
    };
  } catch (e: any) {
    const msg = e?.message || "VTPass education vend failed";
    throw new Error(msg.includes("fetch failed") ? `VTPass fetch failed. Raw: ${rawText || "n/a"}` : msg);
  }
}
